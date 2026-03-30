"""
Deal database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Deal(Base):
    """Deal model for pipeline/kanban tracking"""

    __tablename__ = "deals"

    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    title = Column(String(255), nullable=False)
    contact_id = Column(String(36), nullable=True)
    contact_name = Column(String(255), nullable=True)
    value = Column(Float, default=0.0, nullable=False)
    stage = Column(String(50), default="lead", nullable=False)  # lead, qualified, proposal, negotiation, won, lost
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    notes = Column(String(2000), nullable=True)
    org_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Deal(title='{self.title}', stage='{self.stage}')>"
