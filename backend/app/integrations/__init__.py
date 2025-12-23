"""
Integration Framework for InnoSynth.ai

Provides a pluggable architecture for connecting to external platforms:
- Google Drive
- Slack
- Microsoft 365
- Notion
- And more...

Each connector follows the same interface, making it easy to add new integrations.
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
