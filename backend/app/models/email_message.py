"""
Inbound email message model — synced from a mailbox provider (Outlook/Gmail)
and used as source material for deal-status inference. Distinct from the
outbound campaign `emails` table.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String, Text

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class EmailMessage(Base):
    """Inbound message captured from a synced mailbox"""

    __tablename__ = "email_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    provider = Column(String(20), default="outlook", nullable=False)  # outlook, gmail, seed
    provider_message_id = Column(String(255), nullable=False)  # Graph message id; idempotency by (org_id, provider_message_id) query
    from_address = Column(String(255), nullable=False)
    to_addresses = Column(Text, nullable=True)  # comma-separated
    subject = Column(String(500), nullable=True)
    body_preview = Column(Text, nullable=True)
    received_at = Column(DateTime, nullable=False)
    contact_id = Column(String(36), nullable=True, index=True)
    deal_id = Column(String(36), nullable=True, index=True)
    analyzed_at = Column(DateTime, nullable=True)  # inference has run over this message
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_email_messages_org_provider_msg", "org_id", "provider_message_id"),
    )

    def __repr__(self) -> str:
        return f"<EmailMessage(subject='{self.subject}', from='{self.from_address}')>"
