"""Tombstones router — drop-replication delta endpoint.

Mounted at prefix `/api`.

GET /tombstones?since=<iso>&limit=500

Daemon-auth. Org-scoped. Returns tombstones the daemon hasn't applied yet.
The daemon polls this on every promotion cycle to invalidate its mirror,
soft-delete signals, and honor RTBF email-hash purges.

See plan §2.2 (cloud rejection handling) and §11 (RTBF).
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DaemonCredential, SignalTombstone
from app.services.daemon_auth_service import get_current_daemon

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class TombstoneEntry(BaseModel):
    id: str
    tombstone_type: str
    signal_id: Optional[str] = None
    contact_id: Optional[str] = None
    email_hash: Optional[str] = None
    issued_at: str


class TombstonesListResponse(BaseModel):
    tombstones: list[TombstoneEntry]
    next_since: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/tombstones", response_model=TombstonesListResponse)
async def list_tombstones(
    since: Optional[datetime] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    daemon: DaemonCredential = Depends(get_current_daemon),
):
    """Daemon delta poll. Tombstones are append-only and ordered by issued_at."""
    org_id = daemon.organization_id

    stmt = (
        select(SignalTombstone)
        .where(SignalTombstone.organization_id == org_id)
        .order_by(SignalTombstone.issued_at.asc())
        .limit(limit)
    )
    if since is not None:
        stmt = stmt.where(SignalTombstone.issued_at >= since)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    next_since = rows[-1].issued_at.isoformat() if len(rows) == limit else None

    return TombstonesListResponse(
        tombstones=[
            TombstoneEntry(
                id=t.id,
                tombstone_type=t.tombstone_type,
                signal_id=t.signal_id,
                contact_id=t.contact_id,
                email_hash=t.email_hash,
                issued_at=t.issued_at.isoformat() if t.issued_at else "",
            )
            for t in rows
        ],
        next_since=next_since,
    )
