"""
Organization database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text
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

    # BYOK - Bring Your Own Key (Anthropic API)
    anthropic_api_key = Column(String(255), nullable=True)

    # Mautic CRM Connection
    mautic_url = Column(String(255), nullable=True)
    mautic_client_id = Column(String(255), nullable=True)
    mautic_client_secret = Column(String(255), nullable=True)
    mautic_access_token = Column(Text, nullable=True)
    mautic_refresh_token = Column(Text, nullable=True)
    mautic_token_expires_at = Column(DateTime, nullable=True)

    # Relationships
    users = relationship("User", back_populates="organization")
    documents = relationship("Document", back_populates="organization")

    def __repr__(self):
        return f"<Organization(name='{self.name}', domain='{self.domain}')>"
