"""
Password reset token model for secure password recovery.
"""

import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


def generate_reset_token():
    """Generate a cryptographically secure reset token."""
    return secrets.token_urlsafe(32)


class PasswordResetToken(Base):
    """
    Password reset token for email-based password recovery.

    Tokens are:
    - Single-use (deleted after successful reset)
    - Time-limited (expire after 1 hour)
    - Cryptographically secure (secrets.token_urlsafe)
    """

    __tablename__ = "password_reset_tokens"

    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True
    )
    user_id = Column(
        String(36),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    token = Column(
        String(64),
        unique=True,
        nullable=False,
        default=generate_reset_token,
        index=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=1),
        nullable=False
    )
    used_at = Column(DateTime, nullable=True)

    @property
    def is_expired(self) -> bool:
        """Check if the token has expired."""
        return datetime.utcnow() > self.expires_at

    @property
    def is_used(self) -> bool:
        """Check if the token has been used."""
        return self.used_at is not None

    @property
    def is_valid(self) -> bool:
        """Check if the token is still valid (not expired and not used)."""
        return not self.is_expired and not self.is_used

    def __repr__(self):
        return f"<PasswordResetToken(user_id='{self.user_id}', expires_at='{self.expires_at}')>"
