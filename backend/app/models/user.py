"""
User database model
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    """User model for authentication and authorization"""

    __tablename__ = "users"

    user_id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    organization_id = Column(
        String(36),
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True
    )
    role = Column(String(50), default="user", nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth users
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    # OAuth fields (optional - for users who sign in via Google/Microsoft)
    oauth_provider = Column(String(50), nullable=True)  # 'google', 'microsoft', etc.
    oauth_id = Column(String(255), nullable=True)  # Provider's user ID

    # IANA timezone string (e.g. "America/Los_Angeles"). Used by the Ghostlog
    # morning-digest scheduler to fire at 7am local time per user.
    timezone = Column(String(64), nullable=False, default="America/Los_Angeles")

    # GDPR EU strict mode (plan §11.3). When true:
    # - Cloud signals POST handler does not store ocr_snippet_hash for unmatched signals
    # - Daemon's unmatched_signals_log TTL is 30 days (vs 90 in non-EU)
    eu_strict_mode = Column(Boolean, nullable=False, default=False)

    # Space Agent: tracks whether first-run onboarding modal was completed
    space_agent_onboarding_completed_at = Column(DateTime, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    queries = relationship("Query", back_populates="user")
    decisions = relationship("Decision", back_populates="user")

    def __repr__(self):
        return f"<User(email='{self.email}', name='{self.name}')>"
