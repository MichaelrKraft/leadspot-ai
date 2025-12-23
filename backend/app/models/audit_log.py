"""
Audit Log database model

Tracks all administrative actions, sensitive operations, and security events
for compliance and security monitoring.
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class AuditLog(Base):
    """Audit log model for tracking system actions and security events"""

    __tablename__ = "audit_logs"

    # Using String(36) for UUIDs to support both PostgreSQL and SQLite
    log_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    organization_id = Column(
        String(36),
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True
    )
    user_id = Column(
        String(36),
        ForeignKey("users.user_id"),
        nullable=True,  # Nullable for system actions
        index=True
    )

    # Action details
    action = Column(String(100), nullable=False, index=True)  # e.g., "user.create", "org.update"
    resource_type = Column(String(50), nullable=False, index=True)  # e.g., "user", "organization"
    resource_id = Column(String(255), nullable=True, index=True)  # ID of affected resource

    # Context - Using JSON instead of JSONB for SQLite compatibility
    details = Column(JSON, nullable=True)  # Additional context as JSON
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)  # Browser/client info

    # Metadata
    status = Column(String(20), default="success", nullable=False)  # success, failure, error
    error_message = Column(Text, nullable=True)  # If status is failure/error
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    organization = relationship("Organization")
    user = relationship("User")

    def __repr__(self):
        return f"<AuditLog(action='{self.action}', resource='{self.resource_type}')>"
