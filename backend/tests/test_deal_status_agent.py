"""
Tests for the deal-status inference agent and per-pipeline deal validation.
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select

from app.models.deal import Deal
from app.models.deal_suggestion import DealSuggestion
from app.services.inference.deal_status_agent import analyze_source_for_deal_status
from app.routers.deals import PIPELINE_STAGES, VALID_PIPELINES, _valid_stages


ORG = "org-test-1"


def make_mock_claude(tool_input: dict) -> MagicMock:
    """Build a mock AsyncAnthropic client returning one tool_use block."""
    block = SimpleNamespace(type="tool_use", name="report_deal_status", input=tool_input)
    response = SimpleNamespace(content=[block])
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=response)
    return client


async def make_leasing_deal(db, title="Suite 200 — Portsmouth Tech Park", stage="inquiry") -> Deal:
    deal = Deal(
        title=title,
        contact_name="Jane Broker",
        value=1_200_000,
        pipeline="leasing",
        stage=stage,
        property_name="Portsmouth Tech Park",
        stage_changed_at=datetime.utcnow(),
        org_id=ORG,
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return deal


class TestPipelineStageValidation:
    def test_pipelines(self):
        assert VALID_PIPELINES == {"sales", "leasing"}

    def test_leasing_stages(self):
        assert _valid_stages("leasing") == {
            "inquiry", "loi_negotiation", "construction_pricing",
            "lease_drafting", "lease_negotiation", "signed", "lost",
        }

    def test_sales_stages_unchanged(self):
        # regression: the original sales pipeline must keep its exact stage set
        assert _valid_stages("sales") == {"lead", "qualified", "proposal", "negotiation", "won", "lost"}
        assert [s.id for s in PIPELINE_STAGES["sales"]] == [
            "lead", "qualified", "proposal", "negotiation", "won", "lost",
        ]


@pytest.mark.asyncio
class TestDealStatusAgent:
    async def test_creates_suggestion(self, db_session):
        deal = await make_leasing_deal(db_session)
        client = make_mock_claude({
            "deal_id": deal.id,
            "suggested_stage": "loi_negotiation",
            "confidence": 85,
            "evidence": "Attached is the executed LOI",
        })

        suggestion = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-1",
            "Attached is the executed LOI for Portsmouth Tech Park.",
            client=client,
        )

        assert suggestion is not None
        assert suggestion.deal_id == deal.id
        assert suggestion.current_stage == "inquiry"
        assert suggestion.suggested_stage == "loi_negotiation"
        assert suggestion.confidence == 85
        assert suggestion.status == "pending"

    async def test_no_op_when_model_returns_null(self, db_session):
        await make_leasing_deal(db_session)
        client = make_mock_claude({
            "deal_id": None, "suggested_stage": None,
            "confidence": 0, "evidence": "",
        })
        result = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-2", "Lunch on Friday?", client=client
        )
        assert result is None

    async def test_rejects_unknown_deal_id(self, db_session):
        await make_leasing_deal(db_session)
        client = make_mock_claude({
            "deal_id": "not-a-real-deal", "suggested_stage": "signed",
            "confidence": 90, "evidence": "quote",
        })
        result = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-3", "text", client=client
        )
        assert result is None

    async def test_rejects_invalid_stage(self, db_session):
        deal = await make_leasing_deal(db_session)
        client = make_mock_claude({
            "deal_id": deal.id, "suggested_stage": "won",  # sales stage, invalid for leasing
            "confidence": 90, "evidence": "quote",
        })
        result = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-4", "text", client=client
        )
        assert result is None

    async def test_rejects_same_stage(self, db_session):
        deal = await make_leasing_deal(db_session, stage="lease_drafting")
        client = make_mock_claude({
            "deal_id": deal.id, "suggested_stage": "lease_drafting",
            "confidence": 90, "evidence": "quote",
        })
        result = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-5", "text", client=client
        )
        assert result is None

    async def test_no_duplicate_pending_suggestion(self, db_session):
        deal = await make_leasing_deal(db_session)
        client = make_mock_claude({
            "deal_id": deal.id, "suggested_stage": "loi_negotiation",
            "confidence": 85, "evidence": "quote",
        })
        first = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-6", "text", client=client
        )
        second = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-7", "text", client=client
        )
        assert first is not None
        assert second is None

        rows = (
            await db_session.execute(
                select(DealSuggestion).where(DealSuggestion.deal_id == deal.id)
            )
        ).scalars().all()
        assert len(rows) == 1

    async def test_skips_org_with_no_open_leasing_deals(self, db_session):
        client = make_mock_claude({})
        result = await analyze_source_for_deal_status(
            db_session, "org-empty", "email", "src-8", "text", client=client
        )
        assert result is None
        client.messages.create.assert_not_called()

    async def test_confidence_clamped(self, db_session):
        deal = await make_leasing_deal(db_session)
        client = make_mock_claude({
            "deal_id": deal.id, "suggested_stage": "construction_pricing",
            "confidence": 250, "evidence": "quote",
        })
        suggestion = await analyze_source_for_deal_status(
            db_session, ORG, "email", "src-9", "text", client=client
        )
        assert suggestion.confidence == 100
