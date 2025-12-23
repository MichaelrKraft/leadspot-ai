"""OAuth connection model for storing encrypted OAuth tokens"""

import enum

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class ConnectionStatus(str, enum.Enum):
    """OAuth connection status"""

    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    ERROR = "error"


class OAuthConnection(Base):
    """Model for storing OAuth connection information with encrypted tokens"""

    __tablename__ = "oauth_connections"

    # Primary key
    connection_id = Column(String(36), primary_key=True, index=True)

    # Foreign keys
    organization_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)  # User who connected

    # Provider information
    provider = Column(
        String(50), nullable=False, index=True
    )  # 'google', 'microsoft', 'slack'

    # Encrypted tokens (stored as encrypted strings)
    access_token = Column(Text, nullable=False)  # Encrypted access token
    refresh_token = Column(Text, nullable=True)  # Encrypted refresh token (optional)

    # Token metadata
    expires_at = Column(DateTime, nullable=True)  # When access token expires
    scopes = Column(Text, nullable=False)  # Comma-separated list of granted scopes

    # User information from provider
    connected_user_email = Column(String(255), nullable=True)
    connected_user_name = Column(String(255), nullable=True)
    provider_user_id = Column(String(255), nullable=True)  # User ID from provider

    # Additional provider-specific data
    provider_metadata = Column(Text, nullable=True)  # JSON string for extra data

    # Connection status
    status = Column(
        Enum(ConnectionStatus),
        nullable=False,
        default=ConnectionStatus.ACTIVE,
        index=True,
    )

    # Sync status
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(50), nullable=True)
    documents_synced = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<OAuthConnection {self.connection_id} {self.provider} {self.status}>"

    def to_dict(self, include_tokens: bool = False):
        """
        Convert model to dictionary.

        Args:
            include_tokens: Whether to include encrypted tokens (default: False)

        Returns:
            Dictionary representation of the connection
        """
        data = {
            "connection_id": self.connection_id,
            "organization_id": self.organization_id,
            "user_id": self.user_id,
            "provider": self.provider,
            "scopes": self.scopes.split(",") if self.scopes else [],
            "connected_user_email": self.connected_user_email,
            "connected_user_name": self.connected_user_name,
            "status": self.status.value if isinstance(self.status, ConnectionStatus) else self.status,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "last_sync_status": self.last_sync_status,
            "documents_synced": self.documents_synced,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_tokens:
            data["access_token"] = self.access_token
            data["refresh_token"] = self.refresh_token

        return data
