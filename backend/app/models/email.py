"""
Email database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Email(Base):
    """Email model for sent, draft, and scheduled emails"""

    __tablename__ = "emails"

    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    subject = Column(String(500), nullable=False)
    status = Column(String(50), default="Draft", nullable=False)   # Sent, Draft, Scheduled, Failed
    from_addr = Column(String(255), nullable=False)
    to_addr = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    email_type = Column(String(50), default="Outbound", nullable=False)  # Outbound, Inbound
    opened = Column(Boolean, default=False, nullable=False)
    replied = Column(Boolean, default=False, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    user_id = Column(String(36), nullable=False, index=True)
    campaign_id = Column(String(36), nullable=True, index=True)
    contact_id = Column(String(36), nullable=True, index=True)
    message_id = Column(String(255), nullable=True, index=True)
    unsubscribed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Email(subject='{self.subject}', status='{self.status}')>"
