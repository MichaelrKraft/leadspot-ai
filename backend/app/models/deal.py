"""
Deal database model
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, String

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
    pipeline = Column(String(20), default="sales", nullable=False, index=True)  # sales, leasing
    stage = Column(String(50), default="lead", nullable=False)  # validated per-pipeline in the router
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    property_name = Column(String(255), nullable=True)  # leasing pipeline: the property/space
    stage_changed_at = Column(DateTime, nullable=True)
    source_meta = Column(JSON, nullable=True)  # provenance for AI-created/updated deals
    notes = Column(String(2000), nullable=True)
    org_id = Column(String(36), nullable=False, index=True)
    is_demo = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Deal(title='{self.title}', stage='{self.stage}')>"
