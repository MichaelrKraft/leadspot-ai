"""SSE publish/subscribe bridge for signal events.

Per plan §2.5 ("Real-time UX"): contact detail page subscribes to
GET /api/contacts/{id}/signals/stream (SSE). Server pushes on insert via
Postgres LISTEN/NOTIFY channel `signal_inserted`.

Dev (SQLite) has no LISTEN/NOTIFY, so we fall back to an in-process asyncio
pub/sub keyed by contact_id. Same public API; routers don't care which is
running. When prod runs Postgres, swap the implementation transparently.

Boring code, no over-engineering. If we outgrow in-process for prod (multiple
backend workers), we'll wire actual LISTEN/NOTIFY then.
"""

import asyncio
import json
import logging
from collections import defaultdict
from typing import AsyncIterator, Optional

from app.database import engine

logger = logging.getLogger(__name__)


# In-process pub/sub: contact_id -> set of asyncio.Queue. Each subscriber gets
# its own queue so a slow consumer can't drop events for fast ones.
_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
_lock = asyncio.Lock()


# ---------------------------------------------------------------------
# Internal helpers (in-process fallback)
# ---------------------------------------------------------------------

async def _inproc_publish(contact_id: str, payload: dict) -> None:
    """Push to all subscribers for this contact_id."""
    async with _lock:
        queues = list(_subscribers.get(contact_id, ()))
    for q in queues:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            # Skip rather than block; the consumer is too slow.
            logger.warning("SSE queue full for contact_id=%s; dropping event", contact_id)


async def _inproc_subscribe(contact_id: str) -> tuple[asyncio.Queue, callable]:
    """Register a queue for this contact_id. Returns (queue, unsubscribe_fn)."""
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    async with _lock:
        _subscribers[contact_id].add(q)

    async def unsubscribe() -> None:
        async with _lock:
            _subscribers[contact_id].discard(q)
            if not _subscribers[contact_id]:
                _subscribers.pop(contact_id, None)

    return q, unsubscribe


def _is_postgres() -> bool:
    """Detect SQL dialect at call time (engine may be replaced in tests)."""
    try:
        return engine.dialect.name == "postgresql"
    except Exception:
        return False


# ---------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------

async def publish_signal_inserted(
    signal_id: str,
    contact_id: Optional[str],
    organization_id: str,
) -> None:
    """Notify subscribers that a new signal was inserted.

    Empty/None contact_id -> orphan signal, nobody subscribes. No-op.
    """
    if not contact_id:
        return

    payload = {
        "signal_id": signal_id,
        "contact_id": contact_id,
        "organization_id": organization_id,
    }

    if _is_postgres():
        try:
            # Use a raw connection for NOTIFY. Postgres requires this OUTSIDE
            # any active transaction for immediate dispatch — we run it on a
            # dedicated short-lived connection.
            async with engine.connect() as conn:
                # SQLAlchemy's text() avoids quoting/injection; payload is JSON.
                from sqlalchemy import text
                await conn.execute(
                    text("SELECT pg_notify('signal_inserted', :payload)"),
                    {"payload": json.dumps(payload)},
                )
                await conn.commit()
        except Exception:
            logger.exception("pg_notify failed; falling back to in-process publish")
            await _inproc_publish(contact_id, payload)
    else:
        await _inproc_publish(contact_id, payload)


async def subscribe_to_contact(
    contact_id: str,
    organization_id: str,
) -> AsyncIterator[dict]:
    """Yield signal_inserted events for `contact_id`, filtered by org.

    On SQLite: in-process queue (works for single-worker dev).
    On Postgres: LISTEN on `signal_inserted`, filter client-side. Caller is
    responsible for closing the iterator (via async-for break or generator
    cleanup) so the LISTEN connection is released.
    """
    if _is_postgres():
        # Use asyncpg LISTEN via the SQLAlchemy raw connection. We require a
        # dedicated connection; LISTEN ties up the connection for the duration.
        try:
            async with engine.connect() as conn:
                from sqlalchemy import text
                await conn.execute(text("LISTEN signal_inserted"))
                # asyncpg connection is on conn.connection.driver_connection
                raw = conn.connection.driver_connection
                while True:
                    try:
                        notify = await asyncio.wait_for(
                            raw.notifies.get(),  # asyncpg.Connection.notifies is a Queue
                            timeout=1.0,
                        )
                    except asyncio.TimeoutError:
                        continue
                    except AttributeError:
                        # Driver doesn't expose notifies the way we expect —
                        # bail out to in-process fallback.
                        break
                    try:
                        data = json.loads(notify.payload)
                    except (ValueError, AttributeError):
                        continue
                    if data.get("contact_id") != contact_id:
                        continue
                    if data.get("organization_id") != organization_id:
                        continue
                    yield data
            return
        except Exception:
            logger.exception("Postgres LISTEN failed; falling back to in-process subscribe")
            # Fall through to in-process below.

    # In-process subscription (dev / fallback).
    q, unsubscribe = await _inproc_subscribe(contact_id)
    try:
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            if payload.get("organization_id") != organization_id:
                continue
            yield payload
    finally:
        await unsubscribe()
