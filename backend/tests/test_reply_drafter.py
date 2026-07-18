"""
Tests for the reply drafter and its guard rails — mocked Anthropic/vector store.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.models.email_category import SenderRule
from app.models.email_event import EmailEvent
from app.models.style_profile import StyleProfile
from app.services.inference.reply_drafter import (
    NO_DRAFT_SENTINEL,
    build_style_profile,
    draft_reply,
    never_draft,
    under_daily_cap,
)

ORG = "org-drafter-test"


def mock_text_llm(text: str):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=response)
    return client


@pytest.mark.asyncio
class TestReplyDrafter:
    async def test_never_draft_rule(self, db_session):
        db_session.add(
            SenderRule(org_id=ORG, pattern="@lawyer.com", category_name=NO_DRAFT_SENTINEL)
        )
        await db_session.commit()
        assert await never_draft(db_session, ORG, "counsel@lawyer.com") is True
        assert await never_draft(db_session, ORG, "jane@acme.com") is False

    async def test_daily_cap(self, db_session):
        assert await under_daily_cap(db_session, ORG, cap=2) is True
        for i in range(2):
            db_session.add(
                EmailEvent(
                    org_id=ORG, provider_message_id=f"m-{i}", action="drafted",
                    created_at=datetime.utcnow(),
                )
            )
        await db_session.commit()
        assert await under_daily_cap(db_session, ORG, cap=2) is False

    async def test_build_style_profile_persists_and_updates(self, db_session):
        bodies = [f"Hi there — quick note number {i}. Thanks, Mike" for i in range(5)]
        profile = await build_style_profile(
            db_session, ORG, "mike@test.co", bodies, mock_text_llm("- casual\n- signs off 'Thanks, Mike'")
        )
        assert profile and "casual" in profile

        row = (
            await db_session.execute(
                select(StyleProfile).where(StyleProfile.org_id == ORG)
            )
        ).scalar_one()
        assert row.mailbox_email == "mike@test.co"

        # Rebuild updates in place, no duplicate row
        await build_style_profile(
            db_session, ORG, "mike@test.co", bodies, mock_text_llm("- formal")
        )
        rows = (
            await db_session.execute(
                select(StyleProfile).where(StyleProfile.org_id == ORG)
            )
        ).scalars().all()
        assert len(rows) == 1
        assert "formal" in rows[0].profile_md

    async def test_build_style_profile_needs_enough_mail(self, db_session):
        result = await build_style_profile(
            db_session, ORG, "mike@test.co", ["short", "hi"], mock_text_llm("x")
        )
        assert result is None

    async def test_draft_reply_uses_style_and_exemplars(self, db_session):
        db_session.add(
            StyleProfile(org_id=ORG, mailbox_email="mike@test.co", profile_md="- brief and warm")
        )
        await db_session.commit()

        client = mock_text_llm("Happy to send that over — attached.")
        with patch(
            "app.services.inference.reply_drafter.retrieve_exemplars",
            return_value=["Sure — here's the floor plan you asked about."],
        ):
            draft = await draft_reply(
                db_session, ORG, "mike@test.co", "jane@acme.com",
                "Floor plan?", "Could you send the Suite 400 floor plan?", client,
            )

        assert draft == "Happy to send that over — attached."
        prompt = client.messages.create.await_args.kwargs["messages"][0]["content"]
        assert "brief and warm" in prompt
        assert "floor plan you asked about" in prompt
