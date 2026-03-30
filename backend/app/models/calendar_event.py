"""
CalendarEvent database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class CalendarEvent(Base):
    """Calendar event model for scheduling calls, meetings, demos, and tasks"""

    __tablename__ = "calendar_events"

    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    title = Column(String(255), nullable=False)
    start = Column(DateTime(timezone=True), nullable=False)
    end = Column(DateTime(timezone=True), nullable=False)
    type = Column(String(50), nullable=False, default="call")  # call, meeting, demo, task
    contact_id = Column(String(36), nullable=True)
    contact_name = Column(String(255), nullable=True)
    agent_id = Column(String(36), nullable=True)
    notes = Column(String(2000), nullable=True)
    org_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<CalendarEvent(title='{self.title}', start='{self.start}')>"
