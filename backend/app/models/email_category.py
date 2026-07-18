"""
EmailCategory + SenderRule models — per-org editable triage taxonomy.

Seeded with the 8 Fyxer-style categories on first classification for an org.
Sender rules short-circuit the LLM: a matching pattern assigns the category
directly (also the write target of the UI's "always for this sender" action).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, UniqueConstraint

from app.database import Base


class EmailCategory(Base):
    __tablename__ = "email_categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    enabled = Column(Boolean, nullable=False, default=True)
    drafts_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("org_id", "name", name="ux_email_categories_org_name"),
    )


class SenderRule(Base):
    __tablename__ = "sender_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), nullable=False, index=True)
    pattern = Column(String(200), nullable=False)  # substring match on sender address
    category_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("org_id", "pattern", name="ux_sender_rules_org_pattern"),
    )


# The Fyxer-style default taxonomy. drafts_enabled marks categories whose
# inbound mail should get an AI reply draft (Phase C).
DEFAULT_CATEGORIES = [
    ("To Respond", "Emails needing a direct reply from you — questions, requests, active deal threads.", True),
    ("FYI", "Informational emails worth a skim; no reply expected.", False),
    ("Comment", "Comments/mentions from collaboration tools (docs, tickets, PRs).", False),
    ("Notification", "Automated notifications from apps and services.", False),
    ("Meeting Update", "Calendar invites, reschedules, cancellations, meeting-related logistics.", False),
    ("Awaiting Reply", "Threads where you sent the last message and are waiting on the other side.", False),
    ("Actioned", "Threads that were awaiting a reply and have now received one.", False),
    ("Marketing", "Newsletters, promotions, cold outreach, and other bulk mail.", False),
]
