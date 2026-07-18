"""
StyleProfile model — one per (org, mailbox): the LLM-distilled writing-voice
document used as the prompt prefix for reply drafting. Built once from the
mailbox's sent mail during backfill; rebuildable on demand.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, UniqueConstraint

from app.database import Base


class StyleProfile(Base):
    __tablename__ = "style_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), nullable=False, index=True)
    mailbox_email = Column(String(255), nullable=False)
    profile_md = Column(Text, nullable=False)
    built_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("org_id", "mailbox_email", name="ux_style_profiles_org_mailbox"),
    )
