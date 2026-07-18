"""
Tests for GmailInboxSyncService — mocked Gmail client, no network.

Covers the Phase A pipeline: cursor bootstrap, ingestion + dedupe, the
terminal-event crash-retry guarantee, SENT-mail thread state, stale-cursor
resync, and the consecutive-failure circuit breaker.
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.models.email_event import TERMINAL_ACTIONS, EmailEvent
from app.models.email_message import EmailMessage
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.services.connectors.gmail import STALE_CURSOR, GmailMessage
from app.services.sync.gmail_inbox_sync import GmailInboxSyncService, read_meta

ORG = "org-gmail-test"


def gmail_msg(
    msg_id: str,
    thread_id: str = "t-1",
    from_addr: str = "prospect@acme.com",
    is_sent: bool = False,
) -> GmailMessage:
    return GmailMessage(
        id=msg_id,
        thread_id=thread_id,
        from_address=from_addr,
        to_addresses=["me@leadspot.test"],
        subject="Lease question",
        snippet="snippet",
        body="Sending over the first lease draft for Suite 400.",
        received_at=datetime.utcnow(),
        is_inbox=not is_sent,
        is_sent=is_sent,
        is_draft=False,
        label_ids=["SENT"] if is_sent else ["INBOX"],
    )


def make_connection(meta: str = '{"history_id": "100"}') -> OAuthConnection:
    return OAuthConnection(
        connection_id=str(uuid.uuid4()),
        organization_id=ORG,
        user_id="user-1",
        provider="gmail",
        access_token="enc-access",
        refresh_token="enc-refresh",
        expires_at=datetime.utcnow() + timedelta(minutes=60),
        scopes="gmail.readonly",
        status=ConnectionStatus.ACTIVE,
        provider_metadata=meta,
    )


def make_service() -> GmailInboxSyncService:
    service = GmailInboxSyncService()
    service.encryption_service = MagicMock()
    service.encryption_service.decrypt = MagicMock(side_effect=lambda v: v.replace("enc-", "dec-"))
    service.encryption_service.encrypt = MagicMock(side_effect=lambda v: f"enc-{v}")
    return service


def mock_client(messages: dict[str, GmailMessage], ids=None, new_cursor="200"):
    client = MagicMock()
    client.current_history_id = AsyncMock(return_value="500")
    client.list_new_message_ids = AsyncMock(
        return_value=(list(messages) if ids is None else ids, new_cursor)
    )
    client.get_message = AsyncMock(side_effect=lambda mid: messages.get(mid))
    return client


def patch_client(client):
    return patch(
        "app.services.sync.gmail_inbox_sync.GmailClient", return_value=client
    )


@pytest.mark.asyncio
class TestGmailInboxSync:
    async def test_bootstraps_cursor_on_first_run(self, db_session):
        connection = make_connection(meta="{}")
        db_session.add(connection)
        await db_session.commit()

        with patch_client(mock_client({})):
            results = await make_service().sync_connection(
                connection, db_session, run_inference=False
            )

        assert results["bootstrapped"] is True
        assert read_meta(connection)["history_id"] == "500"

    async def test_ingests_inbound_and_is_idempotent(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()
        messages = {"m-1": gmail_msg("m-1")}
        service = make_service()

        with patch_client(mock_client(messages)):
            first = await service.sync_connection(connection, db_session, run_inference=False)
            second = await service.sync_connection(connection, db_session, run_inference=False)

        assert first["messages_synced"] == 1
        assert second["messages_synced"] == 0

        rows = (
            await db_session.execute(select(EmailMessage).where(EmailMessage.org_id == ORG))
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].direction == "inbound"
        assert rows[0].thread_id == "t-1"
        # Full body is never persisted beyond the preview cap
        assert len(rows[0].body_preview) <= 4000

        events = (
            await db_session.execute(select(EmailEvent).where(EmailEvent.org_id == ORG))
        ).scalars().all()
        assert any(e.action in TERMINAL_ACTIONS for e in events)
        assert read_meta(connection)["history_id"] == "200"

    async def test_message_without_terminal_event_is_retried(self, db_session):
        """Regression: an EmailMessage row alone must NOT suppress re-processing.

        A crash after ingestion but before inference leaves a row with no
        terminal event — the next cycle must run inference, not skip.
        """
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()
        # Simulate the crash aftermath: row exists, no events at all.
        db_session.add(
            EmailMessage(
                org_id=ORG,
                provider="gmail",
                provider_message_id="m-crash",
                thread_id="t-9",
                from_address="prospect@acme.com",
                received_at=datetime.utcnow(),
            )
        )
        await db_session.commit()

        inference = AsyncMock(return_value=None)
        with patch_client(mock_client({"m-crash": gmail_msg("m-crash", thread_id="t-9")})), patch(
            "app.services.sync.gmail_inbox_sync.analyze_source_for_deal_status", inference
        ):
            await make_service().sync_connection(connection, db_session, run_inference=True)

        inference.assert_awaited_once()
        events = (
            await db_session.execute(
                select(EmailEvent).where(EmailEvent.provider_message_id == "m-crash")
            )
        ).scalars().all()
        assert any(e.action in TERMINAL_ACTIONS for e in events)

    async def test_inference_failure_leaves_message_retryable(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()

        inference = AsyncMock(side_effect=RuntimeError("api down"))
        with patch_client(mock_client({"m-2": gmail_msg("m-2")})), patch(
            "app.services.sync.gmail_inbox_sync.analyze_source_for_deal_status", inference
        ):
            results = await make_service().sync_connection(
                connection, db_session, run_inference=True
            )

        assert any("inference" in e for e in results["errors"])
        events = (
            await db_session.execute(
                select(EmailEvent).where(EmailEvent.provider_message_id == "m-2")
            )
        ).scalars().all()
        assert not any(e.action in TERMINAL_ACTIONS for e in events)

    async def test_sent_mail_sets_awaiting_reply_and_inbound_clears_it(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()
        service = make_service()

        sent = gmail_msg("m-out", thread_id="t-5", is_sent=True)
        with patch_client(mock_client({"m-out": sent})):
            await service.sync_connection(connection, db_session, run_inference=False)

        out_row = (
            await db_session.execute(
                select(EmailMessage).where(EmailMessage.provider_message_id == "m-out")
            )
        ).scalar_one()
        assert out_row.direction == "outbound"
        assert out_row.category == "Awaiting Reply"

        reply = gmail_msg("m-in", thread_id="t-5")
        with patch_client(mock_client({"m-in": reply})):
            await service.sync_connection(connection, db_session, run_inference=False)

        await db_session.refresh(out_row)
        assert out_row.category == "Actioned"

    async def test_stale_cursor_resyncs_to_now(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()

        client = mock_client({})
        client.list_new_message_ids = AsyncMock(return_value=(STALE_CURSOR, None))
        with patch_client(client):
            results = await make_service().sync_connection(
                connection, db_session, run_inference=False
            )

        assert results["resynced"] is True
        assert read_meta(connection)["history_id"] == "500"

    async def test_paused_connection_is_skipped(self, db_session):
        connection = make_connection(meta='{"history_id": "100", "paused": true}')
        db_session.add(connection)
        await db_session.commit()

        client = mock_client({"m-3": gmail_msg("m-3")})
        with patch_client(client):
            results = await make_service().sync_connection(
                connection, db_session, run_inference=False
            )

        assert results["paused"] is True
        client.list_new_message_ids.assert_not_awaited()

    async def test_draft_created_for_draft_enabled_category(self, db_session):
        """Full pipeline: classified To Respond + known contact -> Draft row + terminal event."""
        from app.models.contact import Contact
        from app.models.email import Email
        from app.services.inference.email_classifier import Classification

        connection = make_connection()
        connection.connected_user_email = "me@leadspot.test"
        connection.user_id = "user-1"
        db_session.add(connection)
        db_session.add(
            Contact(
                id="c-1", organization_id=ORG, first_name="Jane", last_name="Doe",
                email="prospect@acme.com",
            )
        )
        await db_session.commit()

        classification = Classification("To Respond", "llm", True)
        with patch_client(mock_client({"m-d": gmail_msg("m-d")})), patch(
            "app.services.sync.gmail_inbox_sync.get_anthropic_client",
            AsyncMock(return_value=MagicMock()),
        ), patch(
            "app.services.sync.gmail_inbox_sync.classify_email",
            AsyncMock(return_value=classification),
        ), patch(
            "app.services.sync.gmail_inbox_sync.analyze_source_for_deal_status",
            AsyncMock(return_value=None),
        ), patch(
            "app.services.sync.gmail_inbox_sync.draft_reply",
            AsyncMock(return_value="Sure — sending it over today."),
        ):
            results = await make_service().sync_connection(
                connection, db_session, run_inference=True
            )

        assert results.get("drafts_created") == 1
        draft = (
            await db_session.execute(select(Email).where(Email.contact_id == "c-1"))
        ).scalar_one()
        assert draft.status == "Draft"
        assert draft.to_addr == "prospect@acme.com"
        assert draft.body == "Sure — sending it over today."

        msg_row = (
            await db_session.execute(
                select(EmailMessage).where(EmailMessage.provider_message_id == "m-d")
            )
        ).scalar_one()
        assert msg_row.category == "To Respond"
        events = (
            await db_session.execute(
                select(EmailEvent).where(EmailEvent.provider_message_id == "m-d")
            )
        ).scalars().all()
        assert {"ingested", "classified", "drafted"} <= {e.action for e in events}

    async def test_circuit_breaker_marks_connection_error(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()
        service = make_service()

        tripped = False
        for _ in range(5):
            tripped = await service.record_cycle_outcome(
                connection, db_session, ok=False, error="boom"
            )
        assert tripped is True
        assert connection.status == ConnectionStatus.ERROR

        # A success resets the counter
        connection.status = ConnectionStatus.ACTIVE
        await service.record_cycle_outcome(connection, db_session, ok=True)
        assert read_meta(connection)["consecutive_failures"] == 0
