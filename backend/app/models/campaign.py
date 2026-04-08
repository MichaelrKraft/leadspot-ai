"""
Campaign database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Campaign(Base):
    """Campaign model for email/SMS/voice/multi-step campaigns"""

    __tablename__ = "campaigns"

    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="Draft", nullable=False)  # Active, Paused, Draft, Completed
    type = Column(String(50), default="Email", nullable=False)    # Email, SMS, Voice, Multi-step
    leads = Column(Integer, default=0, nullable=False)
    opened = Column(Integer, default=0, nullable=False)
    replied = Column(Integer, default=0, nullable=False)
    user_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Campaign(name='{self.name}', status='{self.status}')>"
