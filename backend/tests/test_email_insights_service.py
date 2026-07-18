"""
Tests for EmailInsightsService — the email-activity-based replacement for
the Mautic-only InsightsService used by GET /insights/daily.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from app.models.contact import Contact
from app.models.email_message import EmailMessage
from app.services.email_insights_service import EmailInsightsService

ORG = "org-insights-test"


async def make_contact(db, first_name="Jane", last_name="Doe", email="jane@example.com") -> Contact:
    contact = Contact(
        first_name=first_name,
        last_name=last_name,
        email=email,
        organization_id=ORG,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


async def make_message(
    db,
    contact_id=None,
    direction="inbound",
    thread_id="thread-1",
    from_address="jane@example.com",
    received_at=None,
    provider_message_id=None,
) -> EmailMessage:
    msg = EmailMessage(
        org_id=ORG,
        provider="gmail",
        provider_message_id=provider_message_id or f"msg-{datetime.utcnow().timestamp()}",
        thread_id=thread_id,
        direction=direction,
        from_address=from_address,
        received_at=received_at or datetime.utcnow(),
        contact_id=contact_id,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@pytest.mark.asyncio
class TestGetHotLeads:
    async def test_empty_org_returns_no_leads(self, db_session):
        service = EmailInsightsService(db_session, ORG)
        leads = await service.get_hot_leads()
        assert leads == []

    async def test_unreplied_inbound_thread_is_a_hot_lead(self, db_session):
        contact = await make_contact(db_session)
        await make_message(db_session, contact_id=contact.id, direction="inbound", thread_id="t1")

        service = EmailInsightsService(db_session, ORG)
        leads = await service.get_hot_leads()

        assert len(leads) == 1
        assert leads[0]["id"] == contact.id
        assert leads[0]["firstname"] == "Jane"

    async def test_thread_already_replied_to_is_not_a_hot_lead(self, db_session):
        contact = await make_contact(db_session)
        await make_message(
            db_session, contact_id=contact.id, direction="inbound", thread_id="t2",
            received_at=datetime.utcnow() - timedelta(hours=2),
        )
        await make_message(
            db_session, contact_id=contact.id, direction="outbound", thread_id="t2",
            received_at=datetime.utcnow() - timedelta(hours=1),
        )

        service = EmailInsightsService(db_session, ORG)
        leads = await service.get_hot_leads()

        assert leads == []

    async def test_messages_older_than_window_excluded(self, db_session):
        contact = await make_contact(db_session)
        await make_message(
            db_session, contact_id=contact.id, direction="inbound", thread_id="t3",
            received_at=datetime.utcnow() - timedelta(days=30),
        )

        service = EmailInsightsService(db_session, ORG)
        leads = await service.get_hot_leads()

        assert leads == []

    async def test_other_org_messages_excluded(self, db_session):
        contact = await make_contact(db_session)
        msg = EmailMessage(
            org_id="different-org",
            provider="gmail",
            provider_message_id="msg-other-org",
            thread_id="t-other",
            direction="inbound",
            from_address="jane@example.com",
            received_at=datetime.utcnow(),
            contact_id=contact.id,
        )
        db_session.add(msg)
        await db_session.commit()

        service = EmailInsightsService(db_session, ORG)
        leads = await service.get_hot_leads()

        assert leads == []


@pytest.mark.asyncio
class TestGetRecentContacts:
    async def test_most_recent_activity_first(self, db_session):
        older = await make_contact(db_session, first_name="Old", email="old@example.com")
        newer = await make_contact(db_session, first_name="New", email="new@example.com")

        await make_message(
            db_session, contact_id=older.id, from_address="old@example.com",
            thread_id="t-old", received_at=datetime.utcnow() - timedelta(hours=5),
        )
        await make_message(
            db_session, contact_id=newer.id, from_address="new@example.com",
            thread_id="t-new", received_at=datetime.utcnow() - timedelta(hours=1),
        )

        service = EmailInsightsService(db_session, ORG)
        recent = await service.get_recent_contacts()

        assert recent[0]["id"] == newer.id
        assert recent[1]["id"] == older.id


@pytest.mark.asyncio
class TestGetSummaryStats:
    async def test_counts_reflect_org_data(self, db_session):
        contact = await make_contact(db_session)
        await make_message(db_session, contact_id=contact.id, thread_id="t1")
        await make_message(db_session, contact_id=contact.id, thread_id="t2")

        service = EmailInsightsService(db_session, ORG)
        stats = await service.get_summary_stats()

        assert stats["total_contacts"] == 1
        assert stats["total_emails"] == 2
        assert stats["total_campaigns"] == 2  # 2 distinct threads
        assert stats["total_segments"] == 0


@pytest.mark.asyncio
class TestGenerateAiInsights:
    async def test_no_api_key_returns_configure_prompt(self, db_session):
        service = EmailInsightsService(db_session, ORG)
        with patch(
            "app.services.email_insights_service.get_anthropic_client",
            new=AsyncMock(return_value=None),
        ):
            result = await service.generate_ai_insights([], {"total_emails": 0})
        assert "Configure your AI key" in result

    async def test_no_activity_returns_empty_state_message(self, db_session):
        service = EmailInsightsService(db_session, ORG)
        mock_client = AsyncMock()
        with patch(
            "app.services.email_insights_service.get_anthropic_client",
            new=AsyncMock(return_value=mock_client),
        ):
            result = await service.generate_ai_insights([], {"total_emails": 0})
        assert "Connect your inbox" in result
        mock_client.messages.create.assert_not_called()

    async def test_calls_claude_when_activity_exists(self, db_session):
        service = EmailInsightsService(db_session, ORG)
        from types import SimpleNamespace
        block = SimpleNamespace(text="Follow up with Jane — she's waiting on a reply.")
        response = SimpleNamespace(content=[block])
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=response)

        with patch(
            "app.services.email_insights_service.get_anthropic_client",
            new=AsyncMock(return_value=mock_client),
        ):
            result = await service.generate_ai_insights(
                [{"firstname": "Jane", "lastname": "", "email": "jane@example.com", "points": 1, "last_active": "now"}],
                {"total_emails": 3, "total_contacts": 1, "total_campaigns": 1},
            )

        assert "Jane" in result
        mock_client.messages.create.assert_called_once()
