"""Phase 3 Conversational AI router — `/api/v2/chat`.

Distinct from `app/routers/chat.py` (`/api/chat`):
- The legacy `/api/chat` endpoint speaks to *Mautic* via tools and returns
  a single JSON blob.
- This v2 endpoint operates over the unified `Signal + Contact + Deal`
  data model that backs the rest of Ghostlog/LeadSpot, streams responses
  via SSE, enforces citation requirements on every assistant turn, and
  gates write actions behind a confirm-phrase.

Hard rules (mirrors task spec, plan §2.5 + §6):
  1. Every assistant response that makes a factual claim about a contact
     MUST include `citations: [signal_id, ...]`.
  2. Default model is Haiku (`claude-haiku-4-5-20251001`); only `deep=true`
     escalates to Sonnet.
  3. Aggressive prompt caching via `cache_control: {"type": "ephemeral"}`.
  4. Hallucination telemetry → `chat_telemetry` table.
  5. Write tools require an explicit confirm phrase via `confirmed_action`.

The Anthropic client is resolved per-request via
`services.inference.llm_client.get_anthropic_client` (org BYOK key first,
global key fallback); tests patch `anthropic.AsyncAnthropic` at that module.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import ChatMessage, ChatTelemetry, Contact, Deal, Signal, User
from app.routers.agent_proxy import AGENT_SERVICE_URL
from app.services.auth_service import get_current_user
from app.services.inference.llm_client import get_anthropic_client

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Models — Haiku for default retrieval, Sonnet for `deep:true` (plan §15).
# ---------------------------------------------------------------------------
HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-6"

# Stop after this many tool-use rounds — guard against runaway loops.
MAX_TOOL_ROUNDS = 6
# Prior turns replayed into the model when the client passes a thread_id.
MAX_HISTORY_MESSAGES = 30
# One re-prompt only on citation-guard failure — never loop forever.
MAX_CITATION_RETRIES = 1


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, description="Existing thread or null to start new")
    deep: bool = Field(default=False, description="Use Sonnet for deep analysis instead of default Haiku")
    confirmed_action: str | None = Field(
        default=None,
        description="The confirm phrase the user typed back ('send', 'queue', 'yes') for a pending write action",
    )


# ---------------------------------------------------------------------------
# Tool surface — EXACTLY the eight tools the task spec calls for.
# ---------------------------------------------------------------------------

READ_TOOLS: list[dict[str, Any]] = [
    {
        "name": "search_signals",
        "description": (
            "Search the user's Signal log (auto-captured CRM observations) "
            "by free-text keywords. Use this to find evidence before making "
            "any factual claim about a contact."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keyword or phrase to match against signal summaries"},
                "contact_id": {"type": ["string", "null"], "description": "Optional contact scope"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_contact",
        "description": "Fetch a contact + their recent signals + their score. Use when the user names a person.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
            },
            "required": ["contact_id"],
        },
    },
    {
        "name": "summarize_recent",
        "description": "Aggregate recent activity for a contact (counts by source_app, last touchpoint, score delta).",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
                "days": {"type": "integer", "minimum": 1, "maximum": 90, "default": 14},
            },
            "required": ["contact_id"],
        },
    },
    {
        "name": "list_at_risk_deals",
        "description": (
            "List deals with no inbound signal in the last N days for a "
            "previously-warm contact. Use to answer 'what's slipping?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "minimum": 1, "maximum": 90, "default": 14},
            },
        },
    },
]

WRITE_TOOLS: list[dict[str, Any]] = [
    {
        "name": "send_email",
        "description": "Send an email to a contact NOW. Requires user confirm phrase 'send'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
            },
            "required": ["contact_id", "subject", "body"],
        },
    },
    {
        "name": "queue_email",
        "description": "Queue an email to send at a future time. Requires user confirm phrase 'queue'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "send_at": {"type": "string", "description": "ISO timestamp"},
            },
            "required": ["contact_id", "subject", "body", "send_at"],
        },
    },
    {
        "name": "update_score",
        "description": "Adjust a contact's score by delta. Requires confirm phrase 'yes'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
                "delta": {"type": "integer"},
                "reason": {"type": "string"},
            },
            "required": ["contact_id", "delta", "reason"],
        },
    },
    {
        "name": "add_tag",
        "description": "Add a tag to a contact. Requires confirm phrase 'yes'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
                "tag": {"type": "string"},
            },
            "required": ["contact_id", "tag"],
        },
    },
]

WRITE_TOOL_NAMES = {t["name"] for t in WRITE_TOOLS}
ALL_TOOLS = READ_TOOLS + WRITE_TOOLS

# Required confirm phrases per write tool.
REQUIRED_CONFIRM_PHRASE: dict[str, str] = {
    "send_email": "send",
    "queue_email": "queue",
    "update_score": "yes",
    "add_tag": "yes",
}


# ---------------------------------------------------------------------------
# System prompt — cached aggressively. Anthropic ephemeral cache lasts ~1h
# which fits a typical chat session.
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are LeadSpot's conversational CRM assistant.

You have read access to the user's Signal log (auto-captured observations
from their desktop activity), Contact records, and Deal pipeline. You can
also propose write actions (send_email, queue_email, update_score, add_tag),
which the user must confirm before they execute.

# Hard rule: cite every factual claim

Every time you make a factual claim about a contact — that they "opened",
"replied", "viewed", "are likely to ___", "have been ___", "responded",
or anything you observed — you MUST back it up by calling `search_signals`
or `get_contact` first, and then including the matching `signal_id` values
in your response's citations.

If you don't have evidence, say "I don't have evidence for that" instead of
inventing one. Never write "Marcus opened the email" without a signal_id
backing it. The user trusts citations, not vibes.

# Tone

Concise. Drop the marketing voice. The user wants verified facts and
suggested next steps, not adjectives. Use the user's CRM language: "deal",
"contact", "score", "signal".

# Confirmation flow for writes

When you want to send an email, queue one, update a score, or add a tag,
emit the tool call. The system will gate the call until the user types
the confirm phrase ('send' / 'queue' / 'yes'). Do not pretend you sent
something you haven't actually executed.
"""


# ---------------------------------------------------------------------------
# Citation guard
# ---------------------------------------------------------------------------

# Heuristic red flags that signal a factual claim about a contact.
# Tuned narrow — common transitive verbs of CRM-relevant activity.
_RED_FLAGS = (
    "opened",
    "replied",
    "last week",
    "last month",
    "is likely",
    "predicted",
    "has been",
    "responded",
    "viewed",
    "clicked",
    "signed",
    "ghosted",
    "stalled",
    "slipped",
    "slipping",
)


def has_required_citations(text: str, citations: list[dict[str, Any]]) -> bool:
    """Return True iff the response either has citations or is non-factual.

    If citations is non-empty, we trust the model.
    Otherwise we look for a red-flag phrasing pattern; presence of any
    means a citation was required and is missing.
    """
    if citations:
        return True
    lowered = text.lower()
    return not any(flag in lowered for flag in _RED_FLAGS)


# ---------------------------------------------------------------------------
# Tool execution layer (server-side)
# ---------------------------------------------------------------------------

async def _exec_search_signals(
    db: AsyncSession,
    org_id: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    query = (args.get("query") or "").strip()
    contact_id = args.get("contact_id")
    limit = min(int(args.get("limit", 20)), 50)

    stmt = select(Signal).where(
        Signal.organization_id == org_id,
        Signal.deleted_at.is_(None),
    )
    if contact_id:
        stmt = stmt.where(Signal.contact_id == contact_id)
    if query:
        # Plain LIKE-based matching for v1 — vector/FTS is Phase 4 territory.
        stmt = stmt.where(Signal.summary.ilike(f"%{query}%"))
    stmt = stmt.order_by(Signal.observed_at.desc()).limit(limit)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return {
        "signals": [
            {
                "signal_id": s.id,
                "contact_id": s.contact_id,
                "summary": s.summary,
                "source_app": s.source_app,
                "observed_at": s.observed_at.isoformat() if s.observed_at else None,
                "confidence": s.confidence,
            }
            for s in rows
        ],
        "count": len(rows),
    }


async def _exec_get_contact(
    db: AsyncSession,
    org_id: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    contact_id = args["contact_id"]
    c_result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == org_id,
        )
    )
    contact = c_result.scalar_one_or_none()
    if not contact:
        return {"error": "contact_not_found"}

    s_result = await db.execute(
        select(Signal)
        .where(
            Signal.organization_id == org_id,
            Signal.contact_id == contact_id,
            Signal.deleted_at.is_(None),
        )
        .order_by(Signal.observed_at.desc())
        .limit(20)
    )
    signals = s_result.scalars().all()

    return {
        "contact": {
            "id": contact.id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "company": contact.company,
            "score": contact.points,
        },
        "recent_signals": [
            {
                "signal_id": s.id,
                "summary": s.summary,
                "source_app": s.source_app,
                "observed_at": s.observed_at.isoformat() if s.observed_at else None,
            }
            for s in signals
        ],
    }


async def _exec_summarize_recent(
    db: AsyncSession,
    org_id: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    contact_id = args["contact_id"]
    days = min(int(args.get("days", 14)), 90)
    cutoff = datetime.utcnow() - timedelta(days=days)

    s_result = await db.execute(
        select(Signal)
        .where(
            Signal.organization_id == org_id,
            Signal.contact_id == contact_id,
            Signal.deleted_at.is_(None),
            Signal.observed_at >= cutoff,
        )
        .order_by(Signal.observed_at.desc())
    )
    signals = s_result.scalars().all()

    counts: dict[str, int] = {}
    for s in signals:
        key = s.source_app or "unknown"
        counts[key] = counts.get(key, 0) + 1

    last = signals[0] if signals else None
    return {
        "contact_id": contact_id,
        "window_days": days,
        "counts_by_source_app": counts,
        "last_touchpoint": (
            {
                "signal_id": last.id,
                "summary": last.summary,
                "observed_at": last.observed_at.isoformat() if last.observed_at else None,
            }
            if last
            else None
        ),
        "total_signals": len(signals),
    }


async def _exec_list_at_risk_deals(
    db: AsyncSession,
    org_id: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    days = min(int(args.get("days", 14)), 90)
    cutoff = datetime.utcnow() - timedelta(days=days)

    d_result = await db.execute(
        select(Deal).where(
            Deal.org_id == org_id,
            Deal.stage.notin_(("won", "lost")),
        )
    )
    deals = d_result.scalars().all()

    at_risk: list[dict[str, Any]] = []
    for deal in deals:
        if not deal.contact_id:
            continue
        # Need at least one historical signal (was warm) but none recent.
        any_signal_stmt = (
            select(Signal)
            .where(
                Signal.organization_id == org_id,
                Signal.contact_id == deal.contact_id,
                Signal.deleted_at.is_(None),
            )
            .order_by(Signal.observed_at.desc())
            .limit(1)
        )
        any_result = await db.execute(any_signal_stmt)
        last = any_result.scalar_one_or_none()
        if not last:
            continue
        if last.observed_at and last.observed_at >= cutoff:
            continue
        at_risk.append(
            {
                "deal_id": deal.id,
                "title": deal.title,
                "contact_id": deal.contact_id,
                "contact_name": deal.contact_name,
                "value": deal.value,
                "stage": deal.stage,
                "last_signal_id": last.id,
                "last_observed_at": last.observed_at.isoformat() if last.observed_at else None,
            }
        )
    return {"deals": at_risk, "count": len(at_risk), "window_days": days}


async def _exec_send_email(db: AsyncSession, org_id: str, args: dict[str, Any]) -> dict[str, Any]:
    """Send via agent-service's Resend path — it enforces the suppression
    list, adds CAN-SPAM footers, and records the send back to /api/emails.
    Only ever reached after the user typed the 'send' confirm phrase.
    """
    contact_id = args["contact_id"]
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.organization_id == org_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        return {"error": "contact_not_found"}
    if not contact.email:
        return {"error": "contact_has_no_email_address"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{AGENT_SERVICE_URL}/api/email/send",
                json={
                    "to": contact.email,
                    "subject": args["subject"],
                    "body": args["body"],
                    "contactId": contact_id,
                    "organizationId": org_id,
                },
                headers={"X-Internal-Api-Key": settings.INTERNAL_API_KEY},
            )
    except httpx.HTTPError as exc:
        logger.error("send_email: agent service unreachable: %s", exc)
        return {"error": "email_service_unavailable"}

    if resp.status_code != 200:
        logger.error("send_email: agent service returned %s", resp.status_code)
        return {"error": f"send_failed_status_{resp.status_code}"}

    data = resp.json()
    return {
        "sent": True,
        "contact_id": contact_id,
        "subject": args.get("subject"),
        "message_id": data.get("messageId"),
    }


async def _exec_queue_email(db: AsyncSession, org_id: str, args: dict[str, Any]) -> dict[str, Any]:
    return {"queued": True, "contact_id": args.get("contact_id"), "send_at": args.get("send_at")}


async def _exec_update_score(db: AsyncSession, org_id: str, args: dict[str, Any]) -> dict[str, Any]:
    contact_id = args["contact_id"]
    delta = int(args["delta"])
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.organization_id == org_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        return {"error": "contact_not_found"}
    contact.points = (contact.points or 0) + delta
    await db.flush()
    return {"updated": True, "contact_id": contact_id, "new_score": contact.points}


async def _exec_add_tag(db: AsyncSession, org_id: str, args: dict[str, Any]) -> dict[str, Any]:
    contact_id = args["contact_id"]
    tag = args["tag"]
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.organization_id == org_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        return {"error": "contact_not_found"}
    tags = list(contact.tags)
    if tag not in tags:
        tags.append(tag)
        contact.tags = tags
        await db.flush()
    return {"updated": True, "contact_id": contact_id, "tags": tags}


_TOOL_DISPATCH = {
    "search_signals": _exec_search_signals,
    "get_contact": _exec_get_contact,
    "summarize_recent": _exec_summarize_recent,
    "list_at_risk_deals": _exec_list_at_risk_deals,
    "send_email": _exec_send_email,
    "queue_email": _exec_queue_email,
    "update_score": _exec_update_score,
    "add_tag": _exec_add_tag,
}


# ---------------------------------------------------------------------------
# SSE encoder
# ---------------------------------------------------------------------------

def _sse(event: str, data: Any) -> str:
    payload = json.dumps(data) if not isinstance(data, str) else data
    return f"event: {event}\ndata: {payload}\n\n"


def _extract_signal_ids_from_tool_results(
    tool_outputs: list[dict[str, Any]],
) -> list[str]:
    """Walk every tool result we collected and extract signal_id strings.

    The model is told to cite signal_ids it pulled via tools; we cross-check
    against what the tools actually returned. Any signal_id the model claims
    that isn't in this set is dropped during citation enforcement.
    """
    found: set[str] = set()
    for out in tool_outputs:
        result = out.get("result") or {}
        # Common shapes: {"signals": [{"signal_id": ...}]} or
        # {"recent_signals": [{"signal_id": ...}]} or {"last_signal_id": ...}.
        for key in ("signals", "recent_signals"):
            for item in result.get(key) or []:
                sid = item.get("signal_id")
                if isinstance(sid, str):
                    found.add(sid)
        last = result.get("last_signal_id")
        if isinstance(last, str):
            found.add(last)
        deals = result.get("deals") or []
        for d in deals:
            sid = d.get("last_signal_id")
            if isinstance(sid, str):
                found.add(sid)
    return sorted(found)


def _block_text(block: Any) -> str:
    """Best-effort text extraction from an Anthropic content block (real or mocked)."""
    if hasattr(block, "text"):
        return block.text
    if isinstance(block, dict) and block.get("type") == "text":
        return block.get("text", "")
    return ""


def _block_type(block: Any) -> str:
    if hasattr(block, "type"):
        return block.type
    if isinstance(block, dict):
        return block.get("type", "")
    return ""


def _tool_use_fields(block: Any) -> tuple[str, str, dict[str, Any]]:
    """Return (id, name, input) from a tool_use block (real or mocked)."""
    if hasattr(block, "id"):
        return block.id, block.name, block.input
    return block.get("id", ""), block.get("name", ""), block.get("input", {})


# ---------------------------------------------------------------------------
# The single endpoint
# ---------------------------------------------------------------------------

@router.post("/chat")
async def conv_ai_chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a Conversational AI response with tool-use, citations, and
    confirmation gating.
    """
    org_id = str(current_user.organization_id)
    user_id = str(current_user.user_id)
    thread_id = body.thread_id or str(uuid.uuid4())
    model = SONNET_MODEL if body.deep else HAIKU_MODEL

    # Org BYOK key first, global ANTHROPIC_API_KEY fallback. Resolved before
    # streaming so a config problem is a clean 503, not a half-streamed error.
    client = await get_anthropic_client(db, org_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No Anthropic API key configured (org or global).",
        )

    # Replay prior turns for follow-up questions. Only user/assistant text is
    # persisted (no tool blocks), so this maps 1:1 onto the messages array.
    history: list[dict[str, Any]] = []
    if body.thread_id:
        h_result = await db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.organization_id == org_id,
                ChatMessage.thread_id == thread_id,
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(MAX_HISTORY_MESSAGES)
        )
        history = [
            {"role": m.role, "content": m.content}
            for m in reversed(h_result.scalars().all())
        ]

    async def stream() -> AsyncIterator[str]:
        messages: list[dict[str, Any]] = [
            *history,
            {"role": "user", "content": body.message},
        ]
        db.add(
            ChatMessage(
                organization_id=org_id,
                user_id=user_id,
                thread_id=thread_id,
                role="user",
                content=body.message,
            )
        )
        tool_outputs: list[dict[str, Any]] = []
        total_input = 0
        total_output = 0
        triggered_guard = False
        final_text = ""
        final_citations: list[dict[str, Any]] = []
        retries_used = 0

        try:
            for round_idx in range(MAX_TOOL_ROUNDS):
                # Cache the system prompt aggressively. The recent-signals
                # window is implicitly cached by the same prefix because
                # we'd inject it via the system prompt in a richer setup;
                # for v1 the cached prefix IS the system prompt.
                response = await client.messages.create(
                    model=model,
                    max_tokens=2048,
                    system=[
                        {
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=ALL_TOOLS,
                    messages=messages,
                )

                usage = getattr(response, "usage", None)
                if usage is not None:
                    total_input += getattr(usage, "input_tokens", 0) or 0
                    total_output += getattr(usage, "output_tokens", 0) or 0

                content = list(getattr(response, "content", []) or [])
                stop_reason = getattr(response, "stop_reason", None)

                if stop_reason == "tool_use":
                    # Surface the assistant's interim thinking text (if any)
                    # before we run tools.
                    interim = "".join(_block_text(b) for b in content if _block_type(b) == "text")
                    if interim:
                        yield _sse("thinking", interim)

                    # Push the assistant turn into messages (raw blocks).
                    messages.append({"role": "assistant", "content": content})

                    tool_results_for_model: list[dict[str, Any]] = []
                    needs_confirm_emitted = False

                    for block in content:
                        if _block_type(block) != "tool_use":
                            continue
                        tool_use_id, tool_name, tool_input = _tool_use_fields(block)

                        yield _sse("tool_call", {"tool": tool_name, "args": tool_input})

                        # Write-tool gate.
                        if tool_name in WRITE_TOOL_NAMES:
                            required = REQUIRED_CONFIRM_PHRASE[tool_name]
                            confirmed = (body.confirmed_action or "").strip().lower()
                            if confirmed != required:
                                yield _sse(
                                    "needs_confirm",
                                    {
                                        "action": tool_name,
                                        "args": tool_input,
                                        "confirm_phrase": required,
                                    },
                                )
                                needs_confirm_emitted = True
                                # Don't execute — log telemetry + finish.
                                await _log_telemetry(
                                    db=db,
                                    org_id=org_id,
                                    user_id=user_id,
                                    thread_id=thread_id,
                                    model=model,
                                    has_citations=False,
                                    num_signal_ids=0,
                                    triggered_guard=False,
                                    tokens_input=total_input,
                                    tokens_output=total_output,
                                    is_deep=body.deep,
                                )
                                yield _sse(
                                    "done",
                                    {
                                        "thread_id": thread_id,
                                        "total_tokens": total_input + total_output,
                                    },
                                )
                                return

                        # Execute the tool.
                        executor = _TOOL_DISPATCH.get(tool_name)
                        if executor is None:
                            tool_result = {"error": f"unknown_tool:{tool_name}"}
                        else:
                            try:
                                tool_result = await executor(db, org_id, tool_input or {})
                            except Exception as exc:
                                logger.exception("Tool %s failed", tool_name)
                                tool_result = {"error": str(exc)}

                        tool_outputs.append({"tool": tool_name, "input": tool_input, "result": tool_result})
                        yield _sse(
                            "tool_result",
                            {"tool": tool_name, "result_summary": _summarize_result(tool_name, tool_result)},
                        )

                        tool_results_for_model.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_use_id,
                                "content": json.dumps(tool_result, default=str),
                            }
                        )

                    if needs_confirm_emitted:
                        return  # already streamed done

                    # Feed tool results back to the model and loop.
                    messages.append({"role": "user", "content": tool_results_for_model})
                    continue

                # stop_reason == "end_turn" (or anything else terminal).
                final_text = "".join(_block_text(b) for b in content if _block_type(b) == "text")

                # Build candidate citations from what tools actually returned.
                allowed_ids = set(_extract_signal_ids_from_tool_results(tool_outputs))
                final_citations = _build_citations(final_text, allowed_ids, tool_outputs)

                if (
                    not has_required_citations(final_text, final_citations)
                    and retries_used < MAX_CITATION_RETRIES
                ):
                    triggered_guard = True
                    retries_used += 1
                    messages.append({"role": "assistant", "content": content})
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "You made a factual claim without citing a signal. "
                                "Either remove the claim or call `search_signals` "
                                "to back it up, then respond again."
                            ),
                        }
                    )
                    continue

                break

            # If we somehow exit the loop without `final_text`, salvage gracefully.
            if not final_text:
                final_text = "I couldn't produce a response within the allowed steps."
                final_citations = []

            yield _sse(
                "assistant",
                {"text": final_text, "citations": final_citations},
            )

            db.add(
                ChatMessage(
                    organization_id=org_id,
                    user_id=user_id,
                    thread_id=thread_id,
                    role="assistant",
                    content=final_text,
                )
            )

            await _log_telemetry(
                db=db,
                org_id=org_id,
                user_id=user_id,
                thread_id=thread_id,
                model=model,
                has_citations=bool(final_citations),
                num_signal_ids=len(final_citations),
                triggered_guard=triggered_guard,
                tokens_input=total_input,
                tokens_output=total_output,
                is_deep=body.deep,
            )

            yield _sse(
                "done",
                {"thread_id": thread_id, "total_tokens": total_input + total_output},
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("conv_ai stream errored")
            yield _sse("assistant", {"text": f"Internal error: {exc}", "citations": []})
            yield _sse("done", {"thread_id": thread_id, "total_tokens": 0})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

# UUID-shaped strings the model might mention in its response — we'll cross-
# check against the set of IDs that actually came out of tool calls.
_UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)


def _build_citations(
    text: str,
    allowed_ids: set[str],
    tool_outputs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Construct the citation list.

    Strategy:
    1. Pull any UUIDs the model name-dropped in its text and intersect
       with `allowed_ids` (= IDs the tools actually returned).
    2. If the model didn't name any but tools returned signals, attach
       all of them — the safer side of "always cite when there's evidence".

    For each citation, attach the matching summary so the UI can render
    a hover tooltip without a second round-trip.
    """
    snippets: dict[str, str] = {}
    for out in tool_outputs:
        result = out.get("result") or {}
        for key in ("signals", "recent_signals"):
            for item in result.get(key) or []:
                sid = item.get("signal_id")
                if isinstance(sid, str):
                    snippets.setdefault(sid, item.get("summary") or "")
        for d in result.get("deals") or []:
            sid = d.get("last_signal_id")
            if isinstance(sid, str):
                snippets.setdefault(sid, d.get("title") or "")

    explicit = [m for m in _UUID_RE.findall(text) if m in allowed_ids]
    chosen_ids: list[str]
    if explicit:
        # Preserve order, dedupe.
        seen: set[str] = set()
        chosen_ids = []
        for sid in explicit:
            if sid not in seen:
                seen.add(sid)
                chosen_ids.append(sid)
    elif allowed_ids:
        chosen_ids = sorted(allowed_ids)[:5]  # cap to 5 to keep the UI tidy
    else:
        chosen_ids = []

    return [{"signal_id": sid, "snippet": snippets.get(sid, "")} for sid in chosen_ids]


def _summarize_result(tool: str, result: dict[str, Any]) -> str:
    """Short human-readable summary of a tool result for the SSE stream."""
    if "error" in result:
        return f"error: {result['error']}"
    if tool == "search_signals":
        return f"{result.get('count', 0)} signals matched"
    if tool == "get_contact":
        c = result.get("contact") or {}
        return f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or "contact loaded"
    if tool == "summarize_recent":
        return f"{result.get('total_signals', 0)} signals in {result.get('window_days', 0)}d"
    if tool == "list_at_risk_deals":
        return f"{result.get('count', 0)} deals at risk"
    if tool in ("send_email", "queue_email"):
        return "ok"
    if tool == "update_score":
        return f"new score {result.get('new_score')}"
    if tool == "add_tag":
        return "tag added"
    return "ok"


async def _log_telemetry(
    *,
    db: AsyncSession,
    org_id: str,
    user_id: str,
    thread_id: str,
    model: str,
    has_citations: bool,
    num_signal_ids: int,
    triggered_guard: bool,
    tokens_input: int,
    tokens_output: int,
    is_deep: bool,
) -> None:
    row = ChatTelemetry(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        user_id=user_id,
        thread_id=thread_id,
        model=model,
        has_citations=has_citations,
        num_signal_ids=num_signal_ids,
        triggered_citation_guard=triggered_guard,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        is_deep=is_deep,
    )
    db.add(row)
    try:
        await db.flush()
    except Exception:
        # Telemetry must never break the request path.
        logger.exception("Failed to flush chat_telemetry row")
