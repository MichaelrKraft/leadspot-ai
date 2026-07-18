"""
Tests for the email triage classifier — mocked Anthropic, no network.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select

from app.models.email_category import DEFAULT_CATEGORIES, EmailCategory, SenderRule
from app.services.inference.email_classifier import (
    Classification,
    classify_email,
    ensure_categories,
    match_sender_rule,
)

ORG = "org-classifier-test"


def mock_llm(category: str):
    block = MagicMock()
    block.type = "tool_use"
    block.name = "classify_email"
    block.input = {"category": category}
    response = MagicMock()
    response.content = [block]
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=response)
    return client


@pytest.mark.asyncio
class TestEmailClassifier:
    async def test_seeds_default_categories_on_first_use(self, db_session):
        categories = await ensure_categories(db_session, ORG)
        assert [c.name for c in categories] == [name for name, _, _ in DEFAULT_CATEGORIES]
        to_respond = next(c for c in categories if c.name == "To Respond")
        assert to_respond.drafts_enabled is True

        # Second call returns the same rows, no duplicate seeding
        again = await ensure_categories(db_session, ORG)
        assert len(again) == len(DEFAULT_CATEGORIES)
        total = (
            await db_session.execute(
                select(EmailCategory).where(EmailCategory.org_id == ORG)
            )
        ).scalars().all()
        assert len(total) == len(DEFAULT_CATEGORIES)

    async def test_sender_rule_short_circuits_llm(self, db_session):
        await ensure_categories(db_session, ORG)
        db_session.add(SenderRule(org_id=ORG, pattern="@newsletter.co", category_name="Marketing"))
        await db_session.commit()

        client = mock_llm("To Respond")
        result = await classify_email(
            db_session, ORG, "digest@newsletter.co", "Weekly digest", "...", client=client
        )
        assert result == Classification("Marketing", "sender rule", False)
        client.messages.create.assert_not_awaited()

    async def test_llm_classification(self, db_session):
        await ensure_categories(db_session, ORG)
        result = await classify_email(
            db_session, ORG, "jane@acme.com", "Question about Suite 400",
            "Can you send the floor plan?", client=mock_llm("To Respond"),
        )
        assert result.category == "To Respond"
        assert result.reason == "llm"
        assert result.drafts_enabled is True

    async def test_thread_state_categories_not_selectable(self, db_session):
        """Awaiting Reply / Actioned are SENT-mail thread states, never LLM picks."""
        await ensure_categories(db_session, ORG)
        result = await classify_email(
            db_session, ORG, "jane@acme.com", "s", "b", client=mock_llm("Awaiting Reply")
        )
        # Out-of-enum answer falls back to the safe bucket
        assert result.category == "FYI"
        assert result.reason == "fallback"

    async def test_no_llm_configured_returns_none(self, db_session, monkeypatch):
        await ensure_categories(db_session, ORG)
        monkeypatch.setattr(
            "app.services.inference.email_classifier.get_anthropic_client",
            AsyncMock(return_value=None),
        )
        result = await classify_email(db_session, ORG, "a@b.co", "s", "b")
        assert result is None

    async def test_match_sender_rule_case_insensitive(self, db_session):
        db_session.add(SenderRule(org_id=ORG, pattern="Billing@Stripe.com", category_name="Notification"))
        await db_session.commit()
        assert await match_sender_rule(db_session, ORG, "billing@stripe.com") == "Notification"
        assert await match_sender_rule(db_session, ORG, "other@x.com") is None
