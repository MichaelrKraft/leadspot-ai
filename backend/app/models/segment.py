"""
Segment database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Segment(Base):
    """Segment model for grouping contacts into named lists"""

    __tablename__ = "segments"

    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    color = Column(String(20), default="#6366f1", nullable=False)
    contact_count = Column(Integer, default=0, nullable=False)
    filter_type = Column(String(20), default="manual", nullable=False)  # "manual" | "dynamic"
    filter_criteria = Column(Text, nullable=True)
    user_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Segment(name='{self.name}', filter_type='{self.filter_type}')>"
