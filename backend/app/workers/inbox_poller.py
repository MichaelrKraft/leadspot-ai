"""
Inbox poller — background loop driving Gmail ingestion for the Unified Inbox.

Polls every active Gmail OAuth connection on a fixed interval (default 90s),
running GmailInboxSyncService per connection. Deliberately ungated by the
embedding/Pinecone keys that gate sync_worker — this pipeline needs only the
Gmail OAuth credentials and (optionally) an Anthropic key for inference.

Single-process assumption: with multiple uvicorn workers each process would
run its own loop and double-poll. Dedupe + terminal events make that safe but
wasteful; run the API single-process or move this loop to a dedicated process
before scaling out.
"""

import asyncio
import logging

from sqlalchemy import select

from app.database import async_session_maker
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.services.sync.gmail_inbox_sync import GmailInboxSyncService

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 90


class InboxPoller:
    def __init__(self, interval_seconds: int = POLL_INTERVAL_SECONDS):
        self.interval_seconds = interval_seconds
        self.is_running = False
        self.current_task: asyncio.Task | None = None
        self.sync_service = GmailInboxSyncService()

    async def start(self):
        if self.is_running:
            logger.warning("Inbox poller already running")
            return
        self.is_running = True
        logger.info(f"Starting inbox poller (interval: {self.interval_seconds}s)")
        self.current_task = asyncio.create_task(self._run_loop())

    async def stop(self):
        if not self.is_running:
            return
        self.is_running = False
        if self.current_task:
            self.current_task.cancel()
            try:
                await self.current_task
            except asyncio.CancelledError:
                pass
        logger.info("Inbox poller stopped")

    async def _run_loop(self):
        while self.is_running:
            try:
                await self._poll_all_connections()
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Loop-level guard: one broken cycle never kills the poller.
                logger.error(f"inbox_poller: cycle failed: {e}")
            await asyncio.sleep(self.interval_seconds)

    async def _poll_all_connections(self):
        async with async_session_maker() as db:
            connections = (
                await db.execute(
                    select(OAuthConnection).where(
                        OAuthConnection.provider == "gmail",
                        OAuthConnection.status == ConnectionStatus.ACTIVE,
                    )
                )
            ).scalars().all()

            for connection in connections:
                try:
                    results = await self.sync_service.sync_connection(connection, db)
                    if results.get("messages_synced") or results.get("suggestions_created"):
                        logger.info(
                            f"inbox_poller: {connection.connected_user_email}: "
                            f"{results['messages_synced']} synced, "
                            f"{results['suggestions_created']} suggestions"
                        )
                    await self.sync_service.record_cycle_outcome(connection, db, ok=True)
                except Exception as e:
                    logger.error(
                        f"inbox_poller: connection {connection.connection_id} failed: {e}"
                    )
                    tripped = await self.sync_service.record_cycle_outcome(
                        connection, db, ok=False, error=str(e)
                    )
                    if tripped:
                        # Connection just moved to ERROR — surfaced in the inbox
                        # UI via the reconnect banner (Phase D).
                        logger.error(
                            f"inbox_poller: {connection.connected_user_email} needs reconnect"
                        )


_poller: InboxPoller | None = None


async def start_inbox_poller():
    global _poller
    _poller = InboxPoller()
    await _poller.start()


async def stop_inbox_poller():
    if _poller:
        await _poller.stop()
