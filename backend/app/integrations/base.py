"""
Base Connector Interface

All integration connectors must implement this interface.
This ensures consistent behavior across Google Drive, Slack, etc.
"""

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class ConnectorStatus(str, Enum):
    """Status of an integration connector"""
    NOT_CONFIGURED = "not_configured"  # No credentials in environment
    DISCONNECTED = "disconnected"       # Credentials exist but not connected
    CONNECTED = "connected"             # OAuth complete, ready to sync
    SYNCING = "syncing"                 # Currently syncing
    ERROR = "error"                     # Connection or sync error
    DEMO = "demo"                       # Running in demo mode


@dataclass
class IntegrationConfig:
    """Configuration for an integration"""
    provider: str
    name: str
    description: str
    icon: str  # Icon name (e.g., "google-drive", "slack")
    color: str  # Brand color for UI
    scopes: list[str]  # OAuth scopes required
    supports_webhooks: bool = False
    supports_incremental_sync: bool = True
    demo_available: bool = True  # Can run in demo mode without credentials


@dataclass
class SyncedDocument:
    """A document retrieved from an external source"""
    source_id: str              # External ID (e.g., Google Drive file ID)
    title: str
    content: str                # Extracted text content
    mime_type: str
    file_size: int
    source_url: str | None   # Link to view in source system
    author: str | None
    created_at: datetime | None
    modified_at: datetime | None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SyncResult:
    """Result of a sync operation"""
    success: bool
    documents_synced: int
    documents_updated: int
    documents_deleted: int
    errors: list[str] = field(default_factory=list)
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    next_sync_token: str | None = None  # For incremental sync


class BaseConnector(ABC):
    """
    Abstract base class for all integration connectors.

    Implements the Template Method pattern - subclasses override
    specific methods while the base class handles common logic.
    """

    # Class-level configuration (override in subclasses)
    config: IntegrationConfig

    def __init__(
        self,
        organization_id: str,
        access_token: str | None = None,
        refresh_token: str | None = None,
        demo_mode: bool = False
    ):
        self.organization_id = organization_id
        self.access_token = access_token
        self.refresh_token = refresh_token
        self._demo_mode = demo_mode
        self._status = ConnectorStatus.DEMO if demo_mode else ConnectorStatus.DISCONNECTED

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode"""
        return self._demo_mode

    @property
    def status(self) -> ConnectorStatus:
        """Get current connector status"""
        return self._status

    @classmethod
    @abstractmethod
    def get_config(cls) -> IntegrationConfig:
        """Return the configuration for this connector"""
        pass

    @classmethod
    @abstractmethod
    def is_configured(cls) -> bool:
        """Check if required credentials are configured in environment"""
        pass

    @abstractmethod
    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """
        Generate OAuth authorization URL.

        Args:
            redirect_uri: Where to redirect after OAuth
            state: CSRF protection state parameter

        Returns:
            Authorization URL to redirect user to
        """
        pass

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """
        Exchange OAuth authorization code for tokens.

        Args:
            code: Authorization code from OAuth callback
            redirect_uri: Must match the redirect_uri used in get_oauth_url

        Returns:
            Dictionary with access_token, refresh_token, expires_at, etc.
        """
        pass

    @abstractmethod
    async def refresh_access_token(self) -> dict[str, Any]:
        """
        Refresh the access token using the refresh token.

        Returns:
            Dictionary with new access_token, expires_at, etc.
        """
        pass

    @abstractmethod
    async def validate_connection(self) -> bool:
        """
        Validate that the current tokens are valid.

        Returns:
            True if connection is valid, False otherwise
        """
        pass

    @abstractmethod
    async def sync_all(self) -> AsyncIterator[SyncedDocument]:
        """
        Perform a full sync of all documents.

        Yields:
            SyncedDocument objects one at a time (memory efficient)
        """
        pass

    @abstractmethod
    async def sync_incremental(
        self,
        since: datetime | None = None,
        sync_token: str | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """
        Perform incremental sync of changed documents.

        Args:
            since: Only sync documents modified after this time
            sync_token: Token from previous sync for providers that support it

        Yields:
            SyncedDocument objects one at a time
        """
        pass

    @abstractmethod
    async def get_document(self, source_id: str) -> SyncedDocument | None:
        """
        Get a single document by its source ID.

        Args:
            source_id: The external ID of the document

        Returns:
            SyncedDocument or None if not found
        """
        pass

    async def disconnect(self) -> bool:
        """
        Disconnect the integration (revoke tokens if possible).

        Returns:
            True if disconnection was successful
        """
        self._status = ConnectorStatus.DISCONNECTED
        self.access_token = None
        self.refresh_token = None
        return True

    # =========================================================================
    # Demo Mode Methods (override in subclasses for custom demo data)
    # =========================================================================

    async def _generate_demo_documents(self) -> AsyncIterator[SyncedDocument]:
        """
        Generate realistic demo documents.
        Override in subclasses for provider-specific demo data.
        """
        # Default implementation - subclasses should override
        yield SyncedDocument(
            source_id="demo-1",
            title="Sample Document",
            content="This is a sample document for demonstration purposes.",
            mime_type="text/plain",
            file_size=100,
            source_url=None,
            author="Demo User",
            created_at=datetime.utcnow(),
            modified_at=datetime.utcnow(),
        )

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _log_sync_progress(self, count: int, total: int | None = None):
        """Log sync progress"""
        if total:
            logger.info(f"[{self.config.provider}] Synced {count}/{total} documents")
        else:
            logger.info(f"[{self.config.provider}] Synced {count} documents")

    def _handle_error(self, error: Exception, context: str = ""):
        """Handle and log errors consistently"""
        logger.error(f"[{self.config.provider}] {context}: {error!s}")
        self._status = ConnectorStatus.ERROR
