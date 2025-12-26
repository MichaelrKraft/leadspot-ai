"""
Organization database model
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


# Default branding configuration
DEFAULT_BRANDING = {
    "app_name": "LeadSpot.ai",
    "logo_url": None,
    "favicon_url": None,
    "primary_color": "#818cf8",
    "secondary_color": "#a5b4fc",
    "accent_color": "#c7d2fe",
}

# Default feature flags
DEFAULT_FEATURES = {
    "white_label_enabled": False,
    "voice_agents_enabled": False,
    "max_sub_organizations": 0,
    "max_contacts": 10000,
    "max_users": 5,
    "ai_insights_enabled": True,
    "lead_scoring_enabled": True,
}


class Organization(Base):
    """Organization model for multi-tenancy with white-label support"""

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

    # =========================================================================
    # White-Label Hierarchy
    # =========================================================================
    parent_organization_id = Column(
        String(36),
        ForeignKey("organizations.organization_id"),
        nullable=True,
        index=True
    )
    organization_type = Column(
        String(50),
        default="client",
        nullable=False
    )  # platform, agency, client

    # Custom domain for white-label
    custom_domain = Column(String(255), nullable=True, unique=True)

    # Branding configuration (JSON)
    branding = Column(JSONB, default=DEFAULT_BRANDING, nullable=False)

    # Feature flags (JSON)
    features = Column(JSONB, default=DEFAULT_FEATURES, nullable=False)

    # =========================================================================
    # Billing & Wallet (GoHighLevel-style)
    # =========================================================================
    wallet_balance = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    wallet_auto_recharge = Column(Boolean, default=False, nullable=False)
    wallet_recharge_amount = Column(Numeric(10, 2), default=Decimal("50.00"), nullable=False)
    wallet_recharge_threshold = Column(Numeric(10, 2), default=Decimal("10.00"), nullable=False)
    stripe_customer_id = Column(String(255), nullable=True)
    subscription_status = Column(String(50), default="active", nullable=False)

    # =========================================================================
    # Relationships
    # =========================================================================
    users = relationship("User", back_populates="organization")
    documents = relationship("Document", back_populates="organization")

    # Self-referential relationship for parent/children
    parent = relationship(
        "Organization",
        remote_side=[organization_id],
        backref="children",
        foreign_keys=[parent_organization_id]
    )

    def __repr__(self):
        return f"<Organization(name='{self.name}', domain='{self.domain}')>"
