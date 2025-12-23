"""
Organization database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Organization(Base):
    """Organization model for multi-tenancy"""

    __tablename__ = "organizations"

    organization_id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True
    )
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, nullable=False, index=True)
    subscription_tier = Column(String(50), default="pilot", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    users = relationship("User", back_populates="organization")
    documents = relationship("Document", back_populates="organization")

    def __repr__(self):
        return f"<Organization(name='{self.name}', domain='{self.domain}')>"
