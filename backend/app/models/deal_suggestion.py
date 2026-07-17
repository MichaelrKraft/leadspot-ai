"""
AI-proposed deal stage change, pending human review.
Produced by the deal-status inference agent from inbound emails/documents.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class DealSuggestion(Base):
    """Suggested stage change awaiting accept/reject"""

    __tablename__ = "deal_suggestions"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    deal_id = Column(String(36), nullable=False, index=True)
    current_stage = Column(String(50), nullable=False)
    suggested_stage = Column(String(50), nullable=False)
    confidence = Column(Integer, nullable=False, default=0)  # 0-100
    evidence = Column(Text, nullable=True)  # quote from the source that justifies the suggestion
    source_type = Column(String(20), nullable=False)  # email, document
    source_id = Column(String(36), nullable=False)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(36), nullable=True)  # user id

    def __repr__(self) -> str:
        return f"<DealSuggestion(deal={self.deal_id}, {self.current_stage}->{self.suggested_stage}, {self.status})>"
