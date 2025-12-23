"""
Background Sync Worker

Handles background document synchronization:
- Process document queue
- Handle webhook events from external sources
- Schedule periodic syncs
- Retry failed ingestions
"""

import asyncio
import logging
from collections import deque
from datetime import datetime, timedelta
from typing import Any

from app.services.ingestion.pipeline import IngestionPipeline

logger = logging.getLogger(__name__)


class SyncTask:
    """Represents a sync task."""

    def __init__(
        self,
        task_id: str,
        source: str,
        organization_id: str,
        params: dict[str, Any]
    ):
        self.task_id = task_id
        self.source = source
        self.organization_id = organization_id
        self.params = params
        self.status = "pending"
        self.created_at = datetime.utcnow()
        self.started_at: datetime | None = None
        self.completed_at: datetime | None = None
        self.error: str | None = None
        self.documents_synced = 0
        self.documents_failed = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            'task_id': self.task_id,
            'source': self.source,
            'organization_id': self.organization_id,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'documents_synced': self.documents_synced,
            'documents_failed': self.documents_failed,
            'error': self.error
        }


class SyncWorker:
    """Background worker for document synchronization."""

    def __init__(self, pipeline: IngestionPipeline, max_concurrent: int = 3):
        """
        Initialize sync worker.

        Args:
            pipeline: Ingestion pipeline instance
            max_concurrent: Maximum concurrent ingestion tasks
        """
        self.pipeline = pipeline
        self.max_concurrent = max_concurrent
        self.task_queue: deque = deque()
        self.active_tasks: dict[str, SyncTask] = {}
        self.completed_tasks: dict[str, SyncTask] = {}
        self.running = False
        self.worker_task: asyncio.Task | None = None

    async def start(self):
        """Start the background worker."""
        if self.running:
            logger.warning("Worker already running")
            return

        self.running = True
        self.worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Sync worker started")

    async def stop(self):
        """Stop the background worker."""
        self.running = False
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Sync worker stopped")

    def queue_sync(
        self,
        task_id: str,
        source: str,
        organization_id: str,
        params: dict[str, Any]
    ) -> SyncTask:
        """
        Queue a sync task.

        Args:
            task_id: Unique task identifier
            source: Sync source (google-drive, dropbox, etc.)
            organization_id: Organization ID
            params: Sync parameters

        Returns:
            Created sync task
        """
        task = SyncTask(
            task_id=task_id,
            source=source,
            organization_id=organization_id,
            params=params
        )

        self.task_queue.append(task)
        self.active_tasks[task_id] = task

        logger.info(f"Queued sync task {task_id} from {source}")
        return task

    def get_task_status(self, task_id: str) -> dict[str, Any] | None:
        """Get status of a sync task."""
        task = self.active_tasks.get(task_id) or self.completed_tasks.get(task_id)
        return task.to_dict() if task else None

    async def _worker_loop(self):
        """Main worker loop."""
        logger.info("Worker loop started")

        while self.running:
            try:
                # Process tasks from queue
                if self.task_queue:
                    # Check if we have capacity
                    active_count = sum(
                        1 for task in self.active_tasks.values()
                        if task.status == "processing"
                    )

                    if active_count < self.max_concurrent:
                        task = self.task_queue.popleft()
                        asyncio.create_task(self._process_task(task))

                # Sleep before next check
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error in worker loop: {e!s}", exc_info=True)
                await asyncio.sleep(5)

    async def _process_task(self, task: SyncTask):
        """Process a sync task."""
        task.status = "processing"
        task.started_at = datetime.utcnow()

        logger.info(f"Processing sync task {task.task_id} from {task.source}")

        try:
            # Route to appropriate sync handler
            if task.source == "google-drive":
                await self._sync_google_drive(task)
            elif task.source == "gmail":
                await self._sync_gmail(task)
            elif task.source == "dropbox":
                await self._sync_dropbox(task)
            elif task.source == "webhook":
                await self._process_webhook(task)
            else:
                raise ValueError(f"Unknown sync source: {task.source}")

            task.status = "completed"
            logger.info(
                f"Completed sync task {task.task_id}: "
                f"{task.documents_synced} synced, {task.documents_failed} failed"
            )

        except Exception as e:
            task.status = "failed"
            task.error = str(e)
            logger.error(f"Error processing sync task {task.task_id}: {e!s}", exc_info=True)

        finally:
            task.completed_at = datetime.utcnow()

            # Move to completed
            self.completed_tasks[task.task_id] = task
            del self.active_tasks[task.task_id]

            # Clean old completed tasks (keep for 24 hours)
            self._clean_completed_tasks()

    async def _sync_google_drive(self, task: SyncTask):
        """
        Sync documents from Google Drive.

        Note: This requires Google Drive API setup.
        For MVP, this is a placeholder.
        """
        # TODO: Implement Google Drive sync
        logger.warning("Google Drive sync not yet implemented")
        task.error = "Google Drive sync requires API setup"

    async def _sync_dropbox(self, task: SyncTask):
        """
        Sync documents from Dropbox.

        Note: This requires Dropbox API setup.
        For MVP, this is a placeholder.
        """
        # TODO: Implement Dropbox sync
        logger.warning("Dropbox sync not yet implemented")
        task.error = "Dropbox sync requires API setup"

    async def _sync_gmail(self, task: SyncTask):
        """
        Sync emails from Gmail.

        Uses the GmailSyncService to sync emails to documents.

        Args:
            task: Sync task containing connection_id and sync options
        """
        from sqlalchemy import select

        from app.database import async_session_maker
        from app.models.oauth_connection import OAuthConnection
        from app.services.sync import GmailSyncService

        connection_id = task.params.get('connection_id')
        max_emails = task.params.get('max_emails', 500)
        include_attachments = task.params.get('include_attachments', True)
        thread_mode = task.params.get('thread_mode', True)

        if not connection_id:
            raise ValueError("No connection_id provided for Gmail sync")

        try:
            async with async_session_maker() as db:
                # Get the OAuth connection
                query = select(OAuthConnection).where(
                    OAuthConnection.connection_id == connection_id
                )
                result = await db.execute(query)
                connection = result.scalar_one_or_none()

                if not connection:
                    raise ValueError(f"Connection {connection_id} not found")

                if connection.status != "active":
                    raise ValueError(f"Connection {connection_id} is not active")

                # Run the sync
                sync_service = GmailSyncService()
                results = await sync_service.sync_connection(
                    connection=connection,
                    db=db,
                    max_emails=max_emails,
                    include_attachments=include_attachments,
                    thread_mode=thread_mode
                )

                # Update task stats
                task.documents_synced = results.get('documents_synced', 0)
                task.documents_failed = len(results.get('errors', []))

                if results.get('errors'):
                    logger.warning(f"Gmail sync had {len(results['errors'])} errors: {results['errors'][:5]}")

                logger.info(
                    f"Gmail sync completed for connection {connection_id}: "
                    f"{task.documents_synced} synced, {task.documents_failed} failed"
                )

        except Exception as e:
            logger.error(f"Gmail sync failed for connection {connection_id}: {e!s}")
            raise

    async def _process_webhook(self, task: SyncTask):
        """
        Process webhook event (e.g., new file uploaded to external service).

        Args:
            task: Sync task containing webhook data
        """
        webhook_data = task.params.get('webhook_data', {})
        file_url = webhook_data.get('file_url')
        mime_type = webhook_data.get('mime_type')

        if not file_url:
            raise ValueError("No file URL in webhook data")

        # Download file and ingest
        # TODO: Implement file download from URL
        logger.info(f"Processing webhook for file: {file_url}")

        # Placeholder for actual implementation
        task.documents_synced = 1

    def _clean_completed_tasks(self):
        """Remove completed tasks older than 24 hours."""
        cutoff = datetime.utcnow() - timedelta(hours=24)

        to_remove = [
            task_id for task_id, task in self.completed_tasks.items()
            if task.completed_at and task.completed_at < cutoff
        ]

        for task_id in to_remove:
            del self.completed_tasks[task_id]

        if to_remove:
            logger.info(f"Cleaned {len(to_remove)} old completed tasks")

    def get_stats(self) -> dict[str, Any]:
        """Get worker statistics."""
        active_count = sum(
            1 for task in self.active_tasks.values()
            if task.status == "processing"
        )

        return {
            'running': self.running,
            'queued': len(self.task_queue),
            'active': active_count,
            'completed': len(self.completed_tasks),
            'max_concurrent': self.max_concurrent
        }


# Singleton instance (to be initialized in main app)
sync_worker: SyncWorker | None = None


def get_sync_worker() -> SyncWorker:
    """Get sync worker instance."""
    global sync_worker
    if not sync_worker:
        raise RuntimeError("Sync worker not initialized")
    return sync_worker


def init_sync_worker(pipeline: IngestionPipeline) -> SyncWorker:
    """Initialize sync worker singleton."""
    global sync_worker
    sync_worker = SyncWorker(pipeline)
    return sync_worker
