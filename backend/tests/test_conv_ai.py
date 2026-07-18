"""Tests for the Phase 3 Conversational AI router (/api/v2/chat).

Mocking strategy
----------------
The Anthropic API key is intentionally not present in this environment. We
patch `anthropic.AsyncAnthropic` at the import path the client resolver uses
(`app.services.inference.llm_client.anthropic.AsyncAnthropic`) so the router
receives a canned client that returns scripted tool-use traces.

Each scripted "turn" is a fake response object with:
  - `.content`: list of fake `text` and `tool_use` blocks
  - `.stop_reason`: "tool_use" or "end_turn"
  - `.usage.input_tokens / .output_tokens`

The fake client's `.messages.create()` returns successive scripted turns,
allowing us to drive the tool-use loop deterministically.

SSE consumption
---------------
We use `httpx.AsyncClient` (already wired in conftest as `async_client`).
The streaming response body is collected and split on `\n\n` boundaries to
recover individual events.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ChatTelemetry, Contact, Signal


# ---------------------------------------------------------------------------
# Fake Anthropic response builders
# ---------------------------------------------------------------------------

def _block_text(text: str) -> Any:
    return SimpleNamespace(type="text", text=text)


def _block_tool_use(tool_name: str, tool_input: dict[str, Any], tool_use_id: str = "tu_1") -> Any:
    return SimpleNamespace(type="tool_use", id=tool_use_id, name=tool_name, input=tool_input)


def _fake_response(stop_reason: str, content: list[Any], in_tokens: int = 100, out_tokens: int = 50) -> Any:
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=content,
        usage=SimpleNamespace(input_tokens=in_tokens, output_tokens=out_tokens),
    )


def _fake_anthropic_client(scripted_turns: list[Any]) -> MagicMock:
    """Wrap a list of scripted responses behind a `client.messages.create` mock."""
    iterator = iter(scripted_turns)
    client = MagicMock()

    def _create(**_kwargs: Any) -> Any:
        try:
            return next(iterator)
        except StopIteration as exc:  # pragma: no cover — defensive
            raise AssertionError("Anthropic client called more times than scripted") from exc

    client.messages.create = AsyncMock(side_effect=_create)
    return client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _set_api_key():
    """The router refuses to stream without ANTHROPIC_API_KEY set; provide a
    placeholder so the gate passes (the actual SDK is mocked anyway)."""
    original = settings.ANTHROPIC_API_KEY
    settings.ANTHROPIC_API_KEY = "test-key"
    yield
    settings.ANTHROPIC_API_KEY = original


@pytest_asyncio.fixture
async def seeded_org(db_session: AsyncSession, test_user_data: dict[str, Any]):
    """Seed a contact, two signals, and a foreign-org signal for isolation tests."""
    org_id = test_user_data["organization_id"]
    foreign_org_id = str(uuid4())

    contact = Contact(
        id=str(uuid4()),
        first_name="Marcus",
        last_name="Lee",
        email="marcus@example.com",
        organization_id=org_id,
        points=42,
    )
    db_session.add(contact)

    sig_in = Signal(
        id=str(uuid4()),
        idempotency_key=str(uuid4()),
        contact_id=contact.id,
        contact_match_key="x" * 64,
        organization_id=org_id,
        source="ambient_screen",
        source_app="Gmail",
        extractor="email_open",
        summary="Marcus opened the Q3 pricing email twice",
        confidence=85,
        observed_at=datetime.utcnow() - timedelta(hours=2),
        daemon_id=str(uuid4()),
    )
    sig_other = Signal(
        id=str(uuid4()),
        idempotency_key=str(uuid4()),
        contact_id=str(uuid4()),
        contact_match_key="y" * 64,
        organization_id=foreign_org_id,
        source="ambient_screen",
        source_app="Gmail",
        extractor="email_open",
        summary="Foreign-org leak signal SHOULD NOT show",
        confidence=85,
        observed_at=datetime.utcnow() - timedelta(hours=1),
        daemon_id=str(uuid4()),
    )
    db_session.add_all([sig_in, sig_other])
    await db_session.commit()
    return SimpleNamespace(
        org_id=org_id,
        foreign_org_id=foreign_org_id,
        contact_id=contact.id,
        own_signal_id=sig_in.id,
        foreign_signal_id=sig_other.id,
    )


@pytest_asyncio.fixture
async def authed_user(db_session: AsyncSession, test_user_data: dict[str, Any]):
    """Create the user record matching test_user_data so get_current_user resolves."""
    from app.models import User
    from app.services.auth_service import hash_password

    user = User(
        user_id=test_user_data["organization_id"],  # auth_headers fixture aligns these
        email=test_user_data["email"],
        hashed_password=hash_password(test_user_data["password"]),
        name=test_user_data["name"],
        organization_id=test_user_data["organization_id"],
        role="user",
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    return user


# ---------------------------------------------------------------------------
# SSE parsing helper
# ---------------------------------------------------------------------------

def _parse_sse(body: str) -> list[tuple[str, Any]]:
    events: list[tuple[str, Any]] = []
    for chunk in body.split("\n\n"):
        if not chunk.strip():
            continue
        event_name = ""
        data_payload = ""
        for line in chunk.splitlines():
            if line.startswith("event:"):
                event_name = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data_payload = line[len("data:") :].strip()
        if not event_name:
            continue
        try:
            parsed = json.loads(data_payload) if data_payload else None
        except json.JSONDecodeError:
            parsed = data_payload
        events.append((event_name, parsed))
    return events


async def _post_chat(client: AsyncClient, headers: dict[str, str], body: dict[str, Any]) -> str:
    """POST /api/v2/chat and return the full streamed body as a string."""
    async with client.stream("POST", "/api/v2/chat", json=body, headers=headers) as resp:
        chunks: list[str] = []
        async for chunk in resp.aiter_text():
            chunks.append(chunk)
        return "".join(chunks)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_signals_scoped_to_org(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
):
    """search_signals must NOT return another org's signals."""
    scripted = [
        _fake_response(
            "tool_use",
            [_block_tool_use("search_signals", {"query": "leak"}, "tu_1")],
        ),
        _fake_response(
            "end_turn",
            [_block_text("I don't have evidence for that.")],
        ),
    ]

    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        mock_cls.return_value = _fake_anthropic_client(scripted)
        body = await _post_chat(
            async_client,
            auth_headers,
            {"message": "Show me the leak", "thread_id": None, "deep": False, "confirmed_action": None},
        )

    events = _parse_sse(body)
    tool_results = [data for evt, data in events if evt == "tool_result"]
    assert tool_results, "Expected tool_result event"
    # The search query "leak" matches the foreign-org summary text — but
    # foreign-org signals must be filtered out by org scope, so 0 hits.
    assert "0 signals" in tool_results[0]["result_summary"]


@pytest.mark.asyncio
async def test_write_tool_without_confirmed_action_emits_needs_confirm(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
):
    """A send_email tool call without confirmed_action="send" must NOT execute."""
    scripted = [
        _fake_response(
            "tool_use",
            [
                _block_tool_use(
                    "send_email",
                    {
                        "contact_id": seeded_org.contact_id,
                        "subject": "Following up",
                        "body": "Hey Marcus...",
                    },
                    "tu_send",
                )
            ],
        ),
    ]

    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        mock_cls.return_value = _fake_anthropic_client(scripted)
        body = await _post_chat(
            async_client,
            auth_headers,
            {
                "message": "Send Marcus a follow-up",
                "thread_id": None,
                "deep": False,
                "confirmed_action": None,
            },
        )

    events = _parse_sse(body)
    confirm_events = [data for evt, data in events if evt == "needs_confirm"]
    assert len(confirm_events) == 1
    assert confirm_events[0]["action"] == "send_email"
    assert confirm_events[0]["confirm_phrase"] == "send"
    # Critically — there must be no tool_result for the gated tool.
    tool_results = [data for evt, data in events if evt == "tool_result"]
    assert all(t["tool"] != "send_email" for t in tool_results), \
        "send_email must not have executed without confirm"


@pytest.mark.asyncio
async def test_write_tool_with_wrong_confirm_phrase_still_gated(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
):
    """`confirmed_action='ok'` for send_email (which requires 'send') stays gated."""
    scripted = [
        _fake_response(
            "tool_use",
            [
                _block_tool_use(
                    "send_email",
                    {
                        "contact_id": seeded_org.contact_id,
                        "subject": "Hi",
                        "body": "...",
                    },
                    "tu_send",
                )
            ],
        ),
    ]

    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        mock_cls.return_value = _fake_anthropic_client(scripted)
        body = await _post_chat(
            async_client,
            auth_headers,
            {
                "message": "Send Marcus a follow-up",
                "thread_id": None,
                "deep": False,
                "confirmed_action": "ok",
            },
        )

    events = _parse_sse(body)
    assert any(evt == "needs_confirm" for evt, _ in events)
    assert all(
        not (evt == "tool_result" and data.get("tool") == "send_email")
        for evt, data in events
    )


@pytest.mark.asyncio
async def test_write_tool_with_correct_confirm_executes(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
):
    """update_score with confirmed_action='yes' must actually execute."""
    scripted = [
        _fake_response(
            "tool_use",
            [
                _block_tool_use(
                    "update_score",
                    {
                        "contact_id": seeded_org.contact_id,
                        "delta": 10,
                        "reason": "warm signal",
                    },
                    "tu_score",
                )
            ],
        ),
        _fake_response(
            "end_turn",
            [_block_text(f"Updated. (signal {seeded_org.own_signal_id})")],
        ),
    ]

    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        mock_cls.return_value = _fake_anthropic_client(scripted)
        body = await _post_chat(
            async_client,
            auth_headers,
            {
                "message": "Bump Marcus's score by 10",
                "thread_id": None,
                "deep": False,
                "confirmed_action": "yes",
            },
        )

    events = _parse_sse(body)
    tool_results = [data for evt, data in events if evt == "tool_result"]
    update_results = [t for t in tool_results if t["tool"] == "update_score"]
    assert update_results, "update_score should have executed with confirmed_action='yes'"
    assert "new score 52" in update_results[0]["result_summary"]


@pytest.mark.asyncio
async def test_factual_claim_without_citations_triggers_reprompt(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
):
    """If the model emits a red-flag phrase with no citations, the server
    re-prompts (one extra round) before accepting the response."""
    scripted = [
        # Turn 1: model claims "Marcus opened the email" with NO tool calls.
        _fake_response("end_turn", [_block_text("Marcus opened the email.")]),
        # Turn 2 (after re-prompt): model corrects course.
        _fake_response("end_turn", [_block_text("I don't have evidence for that.")]),
    ]

    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        client = _fake_anthropic_client(scripted)
        mock_cls.return_value = client
        body = await _post_chat(
            async_client,
            auth_headers,
            {"message": "Did Marcus open it?", "thread_id": None, "deep": False, "confirmed_action": None},
        )

    # The Anthropic client.messages.create should be called twice — once
    # for the original answer, once after the citation guard re-prompt.
    assert client.messages.create.call_count == 2
    events = _parse_sse(body)
    final_assistant = [data for evt, data in events if evt == "assistant"]
    assert final_assistant
    assert "I don't have evidence" in final_assistant[-1]["text"]


@pytest.mark.asyncio
async def test_telemetry_row_recorded(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
    db_session: AsyncSession,
):
    """Every assistant turn writes one chat_telemetry row."""
    scripted = [
        _fake_response("end_turn", [_block_text("Acknowledged.")]),
    ]

    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        mock_cls.return_value = _fake_anthropic_client(scripted)
        await _post_chat(
            async_client,
            auth_headers,
            {"message": "ping", "thread_id": None, "deep": False, "confirmed_action": None},
        )

    from sqlalchemy import select as _select

    rows = (await db_session.execute(_select(ChatTelemetry))).scalars().all()
    assert len(rows) >= 1
    row = rows[-1]
    # "Acknowledged." has no red-flag phrasing → guard should NOT trigger,
    # citations empty is fine.
    assert row.has_citations is False
    assert row.num_signal_ids == 0
    assert row.triggered_citation_guard is False
    assert row.model.startswith("claude-haiku")


@pytest.mark.asyncio
async def test_thread_history_persisted_and_replayed(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_org: Any,
    authed_user: Any,
    db_session: AsyncSession,
):
    """Turn 1 persists both sides of the exchange; turn 2 with the same
    thread_id replays that history into the model call."""
    turn1 = [_fake_response("end_turn", [_block_text("Marcus is a contact in your CRM.")])]
    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        mock_cls.return_value = _fake_anthropic_client(turn1)
        body = await _post_chat(
            async_client,
            auth_headers,
            {"message": "Who is Marcus?", "thread_id": None, "deep": False, "confirmed_action": None},
        )
    events = _parse_sse(body)
    done = [data for evt, data in events if evt == "done"][-1]
    thread_id = done["thread_id"]

    from app.models import ChatMessage as _CM
    from sqlalchemy import select as _select

    rows = (
        (await db_session.execute(_select(_CM).where(_CM.thread_id == thread_id).order_by(_CM.created_at)))
        .scalars()
        .all()
    )
    assert [r.role for r in rows] == ["user", "assistant"]

    turn2 = [_fake_response("end_turn", [_block_text("You asked about Marcus.")])]
    with patch("app.services.inference.llm_client.anthropic.AsyncAnthropic") as mock_cls:
        client = _fake_anthropic_client(turn2)
        mock_cls.return_value = client
        await _post_chat(
            async_client,
            auth_headers,
            {"message": "What did I just ask?", "thread_id": thread_id, "deep": False, "confirmed_action": None},
        )

    sent_messages = client.messages.create.call_args.kwargs["messages"]
    # history (user + assistant from turn 1) precedes the new user turn.
    assert len(sent_messages) == 3
    assert sent_messages[0]["content"] == "Who is Marcus?"
    assert sent_messages[1]["role"] == "assistant"
    assert sent_messages[2]["content"] == "What did I just ask?"


@pytest.mark.asyncio
async def test_exec_send_email_calls_agent_service(
    db_session: AsyncSession,
    seeded_org: Any,
):
    """_exec_send_email resolves the contact and POSTs to agent-service's
    /api/email/send with the internal key; response maps to sent+message_id."""
    from app.routers import conv_ai as conv_ai_mod

    captured: dict[str, Any] = {}

    class _FakeResp:
        status_code = 200

        @staticmethod
        def json() -> dict[str, Any]:
            return {"messageId": "re_123"}

    class _FakeHttpClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> "_FakeHttpClient":
            return self

        async def __aexit__(self, *exc: Any) -> None:
            return None

        async def post(self, url: str, **kwargs: Any) -> _FakeResp:
            captured["url"] = url
            captured["json"] = kwargs.get("json")
            captured["headers"] = kwargs.get("headers")
            return _FakeResp()

    with patch.object(conv_ai_mod.httpx, "AsyncClient", _FakeHttpClient):
        result = await conv_ai_mod._exec_send_email(
            db_session,
            seeded_org.org_id,
            {"contact_id": seeded_org.contact_id, "subject": "Hi", "body": "Hello"},
        )

    assert result["sent"] is True
    assert result["message_id"] == "re_123"
    assert captured["url"].endswith("/api/email/send")
    assert captured["json"]["to"] == "marcus@example.com"
    assert "X-Internal-Api-Key" in captured["headers"]


@pytest.mark.asyncio
async def test_exec_send_email_unknown_contact_errors(
    db_session: AsyncSession,
    seeded_org: Any,
):
    from app.routers import conv_ai as conv_ai_mod

    result = await conv_ai_mod._exec_send_email(
        db_session,
        seeded_org.org_id,
        {"contact_id": str(uuid4()), "subject": "Hi", "body": "Hello"},
    )
    assert result == {"error": "contact_not_found"}
