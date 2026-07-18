"""
Sync Manager for Integration Connectors

Orchestrates document syncing from connected platforms.
Handles both full and incremental syncs, stores documents,
and updates sync status tracking.
"""

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.base import SyncedDocument, SyncResult
from app.integrations.registry import get_registry
from app.models.document import Document
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.services.encryption import get_encryption_service

logger = logging.getLogger(__name__)


class SyncManager:
    """
    Manages document synchronization from external platforms.

    Usage:
        sync_manager = SyncManager(db)
        result = await sync_manager.sync_connection(connection_id)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.registry = get_registry()

    async def sync_connection(
        self,
        connection_id: str,
        full_sync: bool = False
    ) -> SyncResult:
        """
        Sync documents from a connected platform.

        Args:
            connection_id: The OAuth connection ID to sync
            full_sync: If True, re-sync all documents. If False, only sync changes.

        Returns:
            SyncResult with sync statistics
        """
        result = SyncResult(
            success=False,
            documents_synced=0,
            documents_updated=0,
            documents_deleted=0,
        )

        # Get the connection using async query
        query = select(OAuthConnection).where(
            OAuthConnection.connection_id == connection_id
        )
        db_result = await self.db.execute(query)
        connection = db_result.scalar_one_or_none()

        if not connection:
            result.errors.append(f"Connection {connection_id} not found")
            return result

        if connection.status != ConnectionStatus.ACTIVE:
            result.errors.append(f"Connection is not active (status: {connection.status})")
            return result

        # Decrypt tokens before use
        encryption_service = get_encryption_service()
        try:
            decrypted_access_token = encryption_service.decrypt(connection.access_token) if connection.access_token else None
            decrypted_refresh_token = encryption_service.decrypt(connection.refresh_token) if connection.refresh_token else None
        except Exception as e:
            logger.error(f"Failed to decrypt tokens for connection {connection_id}: {e}")
            result.errors.append(f"Token decryption failed: {e!s}")
            return result

        # Get the connector with decrypted tokens
        connector = self.registry.get_connector(
            provider=connection.provider,
            organization_id=connection.organization_id,
            access_token=decrypted_access_token,
            refresh_token=decrypted_refresh_token,
        )

        if not connector:
            result.errors.append(f"Unknown provider: {connection.provider}")
            return result

        # Validate connection
        is_valid = await connector.validate_connection()
        if not is_valid:
            connection.status = ConnectionStatus.ERROR
            connection.last_sync_status = "validation_failed"
            await self.db.commit()
            result.errors.append("Connection validation failed")
            return result

        # Perform sync
        try:
            if full_sync or not connection.last_sync_at:
                # Full sync
                async for doc in connector.sync_all():
                    saved = await self._save_document(connection, doc)
                    if saved:
                        result.documents_synced += 1
                    else:
                        result.documents_updated += 1
            else:
                # Incremental sync
                async for doc in connector.sync_incremental(since=connection.last_sync_at):
                    saved = await self._save_document(connection, doc)
                    if saved:
                        result.documents_synced += 1
                    else:
                        result.documents_updated += 1

            # Update connection status
            connection.last_sync_at = datetime.utcnow()
            connection.last_sync_status = "success"
            connection.documents_synced = (connection.documents_synced or 0) + result.documents_synced
            await self.db.commit()

            result.success = True
            result.completed_at = datetime.utcnow()

            logger.info(
                f"Sync completed for {connection.provider}: "
                f"{result.documents_synced} new, {result.documents_updated} updated"
            )

        except Exception as e:
            logger.error(f"Sync failed for connection {connection_id}: {e}")
            connection.last_sync_status = f"error: {str(e)[:100]}"
            await self.db.commit()
            result.errors.append(str(e))

        return result

    async def _save_document(self, connection: OAuthConnection, synced_doc: SyncedDocument) -> bool:
        """
        Save or update a synced document in the database.

        Args:
            connection: The OAuth connection
            synced_doc: The document to save

        Returns:
            True if new document created, False if existing document updated
        """
        # Check if document already exists using async query
        query = select(Document).where(
            Document.organization_id == connection.organization_id,
            Document.source_system == connection.provider,
            Document.source_id == synced_doc.source_id,
        )
        db_result = await self.db.execute(query)
        existing = db_result.scalar_one_or_none()

        if existing:
            # Update existing document
            existing.title = synced_doc.title
            existing.content = synced_doc.content
            existing.author = synced_doc.author
            existing.file_size = synced_doc.file_size
            existing.mime_type = synced_doc.mime_type
            existing.source_url = synced_doc.source_url
            existing.last_modified = synced_doc.modified_at or datetime.utcnow()
            existing.status = "pending"  # Re-index needed
            await self.db.commit()
            return False

        # Create new document
        doc = Document(
            document_id=str(uuid.uuid4()),
            organization_id=connection.organization_id,
            source_system=connection.provider,
            source_id=synced_doc.source_id,
            source_url=synced_doc.source_url,
            user_id=connection.user_id,
            title=synced_doc.title,
            author=synced_doc.author,
            filename=synced_doc.title,  # Use title as filename for external docs
            content=synced_doc.content,
            file_size=synced_doc.file_size,
            mime_type=synced_doc.mime_type,
            created_at=synced_doc.created_at or datetime.utcnow(),
            last_modified=synced_doc.modified_at or datetime.utcnow(),
            status="pending",  # Needs indexing
        )
        self.db.add(doc)
        await self.db.commit()
        return True

    async def sync_all_connections(
        self,
        organization_id: str,
        full_sync: bool = False
    ) -> dict[str, SyncResult]:
        """
        Sync all active connections for an organization.

        Args:
            organization_id: The organization to sync
            full_sync: If True, re-sync all documents

        Returns:
            Dictionary mapping provider to SyncResult
        """
        results = {}

        query = select(OAuthConnection).where(
            OAuthConnection.organization_id == organization_id,
            OAuthConnection.status == ConnectionStatus.ACTIVE,
        )
        db_result = await self.db.execute(query)
        connections = db_result.scalars().all()

        for connection in connections:
            result = await self.sync_connection(connection.connection_id, full_sync)
            results[connection.provider] = result

        return results

    async def get_sync_status(self, organization_id: str) -> list[dict[str, Any]]:
        """
        Get sync status for all connections in an organization.

        Args:
            organization_id: The organization ID

        Returns:
            List of connection status dictionaries
        """
        query = select(OAuthConnection).where(
            OAuthConnection.organization_id == organization_id,
        )
        db_result = await self.db.execute(query)
        connections = db_result.scalars().all()

        statuses = []
        for conn in connections:
            # Get document count for this connection using async query
            count_query = select(func.count()).select_from(Document).where(
                Document.organization_id == organization_id,
                Document.source_system == conn.provider,
            )
            count_result = await self.db.execute(count_query)
            doc_count = count_result.scalar() or 0

            statuses.append({
                "connection_id": conn.connection_id,
                "provider": conn.provider,
                "status": conn.status.value if isinstance(conn.status, ConnectionStatus) else conn.status,
                "connected_user": conn.connected_user_email or conn.connected_user_name,
                "last_sync_at": conn.last_sync_at.isoformat() if conn.last_sync_at else None,
                "last_sync_status": conn.last_sync_status,
                "documents_synced": conn.documents_synced or 0,
                "total_documents": doc_count,
                "created_at": conn.created_at.isoformat() if conn.created_at else None,
            })

        return statuses


class DemoSyncManager:
    """
    Demo mode sync manager for testing without real database.

    Stores documents in memory and simulates sync behavior.
    """

    def __init__(self):
        self.registry = get_registry()
        self._documents: dict[str, list[SyncedDocument]] = {}
        self._connections: dict[str, dict] = {}

    def create_demo_connection(
        self,
        organization_id: str,
        provider: str
    ) -> dict[str, Any]:
        """Create a demo connection for testing"""
        connection_id = str(uuid.uuid4())

        self._connections[connection_id] = {
            "connection_id": connection_id,
            "organization_id": organization_id,
            "provider": provider,
            "status": "active",
            "connected_user_email": "demo@example.com",
            "last_sync_at": None,
            "documents_synced": 0,
            "created_at": datetime.utcnow().isoformat(),
        }

        return self._connections[connection_id]

    async def sync_demo_connection(
        self,
        connection_id: str
    ) -> SyncResult:
        """Sync a demo connection"""
        result = SyncResult(
            success=False,
            documents_synced=0,
            documents_updated=0,
            documents_deleted=0,
        )

        if connection_id not in self._connections:
            result.errors.append("Connection not found")
            return result

        conn = self._connections[connection_id]

        # Get connector in demo mode
        connector = self.registry.get_connector(
            provider=conn["provider"],
            organization_id=conn["organization_id"],
            force_demo=True,
        )

        if not connector:
            result.errors.append("Provider not found")
            return result

        # Sync documents
        org_id = conn["organization_id"]
        if org_id not in self._documents:
            self._documents[org_id] = []

        async for doc in connector.sync_all():
            # Check for duplicate
            existing = next(
                (d for d in self._documents[org_id]
                 if d.source_id == doc.source_id),
                None
            )

            if existing:
                # Update
                idx = self._documents[org_id].index(existing)
                self._documents[org_id][idx] = doc
                result.documents_updated += 1
            else:
                # Add new
                self._documents[org_id].append(doc)
                result.documents_synced += 1

        # Update connection
        conn["last_sync_at"] = datetime.utcnow().isoformat()
        conn["documents_synced"] = len(self._documents[org_id])

        result.success = True
        result.completed_at = datetime.utcnow()

        return result

    def get_demo_documents(self, organization_id: str) -> list[dict]:
        """Get all demo documents for an organization"""
        docs = self._documents.get(organization_id, [])
        return [
            {
                "source_id": doc.source_id,
                "title": doc.title,
                "content": doc.content[:200] + "..." if len(doc.content) > 200 else doc.content,
                "author": doc.author,
                "source_url": doc.source_url,
                "mime_type": doc.mime_type,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc in docs
        ]

    def get_demo_connection(self, connection_id: str) -> dict | None:
        """Get a demo connection by ID"""
        return self._connections.get(connection_id)

    def list_demo_connections(self, organization_id: str) -> list[dict]:
        """List all demo connections for an organization"""
        return [
            conn for conn in self._connections.values()
            if conn["organization_id"] == organization_id
        ]


# Global demo manager instance for easy testing
_demo_manager: DemoSyncManager | None = None


def get_demo_sync_manager() -> DemoSyncManager:
    """Get the singleton demo sync manager"""
    global _demo_manager
    if _demo_manager is None:
        _demo_manager = DemoSyncManager()
    return _demo_manager
