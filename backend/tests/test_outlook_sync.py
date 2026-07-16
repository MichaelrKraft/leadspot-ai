"""
Tests for OutlookSyncService — mocked Microsoft Graph, no network.
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from sqlalchemy import select

from app.models.contact import Contact
from app.models.deal import Deal
from app.models.email_message import EmailMessage
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.services.sync.outlook_sync import OutlookSyncService


ORG = "org-outlook-test"


def graph_message(msg_id: str, from_addr: str, subject: str, preview: str) -> dict:
    return {
        "id": msg_id,
        "subject": subject,
        "bodyPreview": preview,
        "from": {"emailAddress": {"address": from_addr}},
        "toRecipients": [{"emailAddress": {"address": "kelsey@kanecompany.com"}}],
        "receivedDateTime": "2026-07-15T10:00:00Z",
    }


def make_connection(expires_in_minutes: int = 60) -> OAuthConnection:
    return OAuthConnection(
        connection_id=str(uuid.uuid4()),
        organization_id=ORG,
        user_id="user-1",
        provider="microsoft",
        access_token="enc-access",
        refresh_token="enc-refresh",
        expires_at=datetime.utcnow() + timedelta(minutes=expires_in_minutes),
        scopes="Mail.Read",
        status=ConnectionStatus.ACTIVE,
    )


def make_service() -> OutlookSyncService:
    service = OutlookSyncService()
    service.encryption_service = MagicMock()
    service.encryption_service.decrypt = MagicMock(side_effect=lambda v: v.replace("enc-", "dec-"))
    service.encryption_service.encrypt = MagicMock(side_effect=lambda v: f"enc-{v}")
    return service


def mock_graph_pages(*pages_or_errors):
    """Patch httpx.AsyncClient.get to return canned responses/raises in order."""
    responses = []
    for item in pages_or_errors:
        if isinstance(item, Exception):
            responses.append(item)
        else:
            resp = MagicMock()
            resp.json = MagicMock(return_value=item)
            resp.raise_for_status = MagicMock()
            responses.append(resp)

    call_iter = iter(responses)

    async def fake_get(self, url, headers=None, **kwargs):
        item = next(call_iter)
        if isinstance(item, Exception):
            raise item
        return item

    return patch.object(httpx.AsyncClient, "get", fake_get)


@pytest.mark.asyncio
class TestOutlookSync:
    async def test_syncs_new_messages(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()

        service = make_service()
        page = {"value": [
            graph_message("m1", "broker@cbre.com", "LOI executed", "Executed LOI attached."),
            graph_message("m2", "other@x.com", "Lunch", "Friday?"),
        ]}
        with mock_graph_pages(page):
            results = await service.sync_connection(
                connection, db_session, max_messages=10, run_inference=False
            )

        assert results["messages_synced"] == 2
        assert results["errors"] == []
        rows = (
            await db_session.execute(select(EmailMessage).where(EmailMessage.org_id == ORG))
        ).scalars().all()
        assert {r.provider_message_id for r in rows} == {"m1", "m2"}
        assert connection.last_sync_status == "success"
        assert connection.last_sync_at is not None

    async def test_resync_is_idempotent(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()
        service = make_service()
        page = {"value": [graph_message("m1", "a@b.com", "S", "P")]}

        with mock_graph_pages(page):
            await service.sync_connection(connection, db_session, run_inference=False)
        connection.last_sync_at = None  # force same window again
        with mock_graph_pages(page):
            results = await service.sync_connection(connection, db_session, run_inference=False)

        assert results["messages_synced"] == 0
        assert results["messages_skipped"] == 1
        rows = (
            await db_session.execute(select(EmailMessage).where(EmailMessage.org_id == ORG))
        ).scalars().all()
        assert len(rows) == 1

    async def test_refreshes_expired_token_before_fetch(self, db_session):
        connection = make_connection(expires_in_minutes=-5)  # already expired
        db_session.add(connection)
        await db_session.commit()
        service = make_service()

        new_expiry = datetime.utcnow() + timedelta(hours=1)
        with patch(
            "app.services.oauth.microsoft.MicrosoftOAuthProvider.refresh_access_token",
            new=AsyncMock(return_value=("fresh-token", new_expiry)),
        ) as mock_refresh:
            with mock_graph_pages({"value": []}):
                results = await service.sync_connection(connection, db_session, run_inference=False)

        mock_refresh.assert_awaited_once_with("dec-refresh")
        assert connection.access_token == "enc-fresh-token"
        assert connection.expires_at == new_expiry
        assert results["errors"] == []

    async def test_401_triggers_refresh_and_retry(self, db_session):
        connection = make_connection(expires_in_minutes=60)  # looks valid
        db_session.add(connection)
        await db_session.commit()
        service = make_service()

        err_response = MagicMock()
        err_response.status_code = 401
        auth_error = httpx.HTTPStatusError("401", request=MagicMock(), response=err_response)

        new_expiry = datetime.utcnow() + timedelta(hours=1)
        with patch(
            "app.services.oauth.microsoft.MicrosoftOAuthProvider.refresh_access_token",
            new=AsyncMock(return_value=("fresh-token", new_expiry)),
        ) as mock_refresh:
            with mock_graph_pages(auth_error, {"value": [graph_message("m9", "a@b.com", "S", "P")]}):
                results = await service.sync_connection(connection, db_session, run_inference=False)

        mock_refresh.assert_awaited_once()
        assert results["messages_synced"] == 1
        assert results["errors"] == []

    async def test_matches_contact_and_deal(self, db_session):
        connection = make_connection()
        contact = Contact(
            first_name="Marcus", last_name="Webb",
            email="mwebb@cbre.com", organization_id=ORG,
        )
        db_session.add_all([connection, contact])
        await db_session.flush()
        deal = Deal(
            title="Bay 4 — Dover", contact_id=contact.id, contact_name="Marcus Webb",
            value=1, pipeline="leasing", stage="loi_negotiation", org_id=ORG,
        )
        db_session.add(deal)
        await db_session.commit()

        service = make_service()
        page = {"value": [graph_message("m5", "mwebb@cbre.com", "Re: Dover", "Executed LOI.")]}
        with mock_graph_pages(page):
            await service.sync_connection(connection, db_session, run_inference=False)

        msg = (
            await db_session.execute(
                select(EmailMessage).where(EmailMessage.provider_message_id == "m5")
            )
        ).scalar_one()
        assert msg.contact_id == contact.id
        assert msg.deal_id == deal.id

    async def test_fetch_failure_marks_error(self, db_session):
        connection = make_connection()
        db_session.add(connection)
        await db_session.commit()
        service = make_service()

        err_response = MagicMock()
        err_response.status_code = 500
        server_error = httpx.HTTPStatusError("500", request=MagicMock(), response=err_response)

        with mock_graph_pages(server_error):
            results = await service.sync_connection(connection, db_session, run_inference=False)

        assert results["messages_synced"] == 0
        assert len(results["errors"]) == 1
        assert connection.last_sync_status == "error"
