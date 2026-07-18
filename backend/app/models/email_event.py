"""
EmailEvent model — per-message processing log for the inbox pipeline.

This is the crash-safety state machine ported from inbox-concierge: a message
is only considered fully processed (skip-on-retry) once a TERMINAL action is
logged, not merely ingested or classified. A crash between ingestion and the
draft decision leaves the message retryable on the next poll cycle instead of
silently dropping downstream work. Also the data source for the activity feed.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String, UniqueConstraint

from app.database import Base

# A message with any of these logged actions is done — never re-processed.
TERMINAL_ACTIONS = ["drafted", "skipped", "no-draft-needed"]


class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), nullable=False, index=True)
    provider_message_id = Column(String(255), nullable=False)
    email_message_id = Column(String(36), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    # ingested | classified | analyzed | drafted | skipped | no-draft-needed | error
    action = Column(String(50), nullable=False)
    detail = Column(String(300), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "org_id", "provider_message_id", "action",
            name="ux_email_events_org_msg_action",
        ),
        Index("ix_email_events_org_created", "org_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<EmailEvent({self.action} msg={self.provider_message_id[:16]})>"
