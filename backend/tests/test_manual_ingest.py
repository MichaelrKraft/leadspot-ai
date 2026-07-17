"""
Tests for manual email ingestion (the Analyze Email production feature).
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select

from app.models.deal import Deal
from app.models.email_message import EmailMessage
from app.services.inference.manual_ingest import ingest_manual_email


ORG = "org-manual-test"


def make_mock_claude(tool_input: dict) -> MagicMock:
    block = SimpleNamespace(type="tool_use", name="report_deal_status", input=tool_input)
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=SimpleNamespace(content=[block]))
    return client


async def make_deal(db) -> Deal:
    deal = Deal(
        title="Bay 4 — Dover Industrial Park",
        contact_name="Marcus Webb (CBRE)",
        value=2_100_000,
        pipeline="leasing",
        stage="loi_negotiation",
        property_name="Dover Industrial Park",
        stage_changed_at=datetime.utcnow(),
        org_id=ORG,
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return deal


@pytest.mark.asyncio
class TestManualIngest:
    async def test_creates_message_and_suggestion(self, db_session):
        deal = await make_deal(db_session)
        client = make_mock_claude({
            "deal_id": deal.id,
            "suggested_stage": "construction_pricing",
            "confidence": 84,
            "evidence": "ready to get construction pricing",
        })

        message, suggestion = await ingest_manual_email(
            db_session, ORG,
            body="Executed LOI attached. We're ready to get construction pricing on the TI package.",
            subject="Re: Dover Bay 4 — LOI executed",
            from_address="mwebb@cbre.com",
            client=client,
        )

        assert message.provider == "manual"
        assert message.provider_message_id.startswith("manual-")
        assert message.analyzed_at is not None
        assert message.deal_id == deal.id  # linked to the matched deal

        assert suggestion is not None
        assert suggestion.deal_id == deal.id
        assert suggestion.suggested_stage == "construction_pricing"
        assert suggestion.source_type == "email"
        assert suggestion.source_id == message.id
        assert suggestion.status == "pending"

    async def test_no_match_still_stores_message(self, db_session):
        await make_deal(db_session)
        client = make_mock_claude({
            "deal_id": None, "suggested_stage": None,
            "confidence": 0, "evidence": "",
        })

        message, suggestion = await ingest_manual_email(
            db_session, ORG, body="Lunch on Friday?", client=client
        )

        assert suggestion is None
        assert message.deal_id is None
        stored = (
            await db_session.execute(
                select(EmailMessage).where(EmailMessage.id == message.id)
            )
        ).scalar_one()
        assert stored.provider == "manual"

    async def test_default_from_address(self, db_session):
        await make_deal(db_session)
        client = make_mock_claude({
            "deal_id": None, "suggested_stage": None,
            "confidence": 0, "evidence": "",
        })
        message, _ = await ingest_manual_email(db_session, ORG, body="hello", client=client)
        assert message.from_address == "manual@entry"
