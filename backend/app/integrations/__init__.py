"""
Integration Framework for LeadSpot.ai

Provides a pluggable architecture for connecting to external CRM platforms:
- Mautic CRM (primary)

Each connector follows the same interface for OAuth2 authentication
and data synchronization.
"""

from app.integrations.base import (
    BaseConnector,
    ConnectorStatus,
    IntegrationConfig,
    SyncedDocument,
    SyncResult,
)
from app.integrations.registry import IntegrationRegistry, get_registry
from app.integrations.sync_manager import DemoSyncManager, SyncManager, get_demo_sync_manager

__all__ = [
    "BaseConnector",
    "ConnectorStatus",
    "DemoSyncManager",
    "IntegrationConfig",
    "IntegrationRegistry",
    "SyncManager",
    "SyncResult",
    "SyncedDocument",
    "get_demo_sync_manager",
    "get_registry",
]
