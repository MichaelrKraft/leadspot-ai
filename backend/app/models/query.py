"""
Query analytics database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Query(Base):
    """Query analytics model for tracking user queries"""

    __tablename__ = "queries"

    query_id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True
    )
    user_id = Column(
        String(36),
        ForeignKey("users.user_id"),
        nullable=False,
        index=True
    )
    organization_id = Column(
        String(36),
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True
    )
    query_text = Column(Text, nullable=False)
    response_text = Column(Text, nullable=True)  # Store the AI response
    response_time_ms = Column(Integer, nullable=True)
    sources_cited = Column(Integer, default=0, nullable=False)
    total_sources_found = Column(Integer, default=0, nullable=False)
    tokens_used = Column(Integer, nullable=True)
    cache_hit = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="queries")
    organization = relationship("Organization")

    def __repr__(self):
        return f"<Query(user_id='{self.user_id}', created_at='{self.created_at}')>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.query_id,
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "query_text": self.query_text,
            "response_text": self.response_text,
            "response_time_ms": self.response_time_ms,
            "sources_cited": self.sources_cited,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
