"""Daemon pause router.

Two routes:

- POST /api/daemon/auth/pause   (user JWT) — set/clear paused_until on one
  daemon or every daemon owned by the user. Body:
      {"duration": "1h" | "today" | "forever" | "resume",
       "daemon_id": "<uuid?>"}

- GET  /api/daemon/pause/status (daemon Bearer) — daemon polls every 30s.
  Returns `{paused: bool, paused_until: ISO|null}`. The daemon's local
  paused state mirrors this.

See plan §11 (Compliance) and Phase 2 part A.2 of the build plan.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DaemonCredential, User
from app.services.auth_service import get_current_user
from app.services.daemon_auth_service import get_current_daemon

logger = logging.getLogger(__name__)


# Year-3000 sentinel for "pause indefinitely". Picked so the daemon's
# datetime comparison still works without special-casing NULL semantics.
_FOREVER_SENTINEL = datetime(3000, 1, 1)


# `auth_router` carries `/auth/pause` (user JWT). `status_router` carries
# `/pause/status` (daemon Bearer). Mounted from main.py at distinct prefixes.
auth_router = APIRouter()
status_router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

PauseDuration = Literal["1h", "today", "forever", "resume"]


class PauseRequest(BaseModel):
    duration: PauseDuration
    # Optional daemon_id — when omitted, the action applies to ALL daemons
    # owned by the requesting user.
    daemon_id: Optional[str] = Field(default=None, max_length=36)


class PauseResponse(BaseModel):
    affected: int
    paused_until: Optional[str] = None


class PauseStatusResponse(BaseModel):
    paused: bool
    paused_until: Optional[str] = None


# =============================================================================
# Helpers
# =============================================================================

def _resolve_paused_until(duration: PauseDuration) -> Optional[datetime]:
    """Translate a duration string into a `paused_until` datetime.

    Returns None for "resume" (clear the pause). All other values produce a
    UTC datetime in the future.
    """
    if duration == "resume":
        return None
    now = datetime.utcnow()
    if duration == "1h":
        return now + timedelta(hours=1)
    if duration == "today":
        # Midnight UTC of the next day. Approximation; users in different
        # timezones get something between "rest of day" and "rest of day + 1d"
        # which is fine for a privacy-pause control.
        tomorrow = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return tomorrow
    if duration == "forever":
        return _FOREVER_SENTINEL
    # Pydantic Literal already enforces this, but be defensive.
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported duration: {duration}",
    )


# =============================================================================
# User-facing: set/clear pause
# =============================================================================

@auth_router.post("/pause", response_model=PauseResponse)
async def set_daemon_pause(
    body: PauseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set or clear the pause on one or every daemon for the requesting user."""
    new_paused_until = _resolve_paused_until(body.duration)
    now = datetime.utcnow()

    # Only target daemons this user owns; revoked daemons are excluded so a
    # stale UI submission can't resurrect them.
    base_filter = [
        DaemonCredential.user_id == str(current_user.user_id),
        DaemonCredential.revoked_at.is_(None),
    ]
    if body.daemon_id:
        base_filter.append(DaemonCredential.daemon_id == body.daemon_id)

    stmt = (
        update(DaemonCredential)
        .where(*base_filter)
        .values(
            paused_until=new_paused_until,
            pause_set_at=now if new_paused_until else None,
        )
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    await db.flush()

    affected = result.rowcount or 0
    if body.daemon_id and affected == 0:
        # The user pointed at a daemon they don't own (or doesn't exist).
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daemon not found",
        )

    return PauseResponse(
        affected=affected,
        paused_until=new_paused_until.isoformat() if new_paused_until else None,
    )


# =============================================================================
# Daemon-facing: poll status
# =============================================================================

@status_router.get("/pause/status", response_model=PauseStatusResponse)
async def get_pause_status(
    db: AsyncSession = Depends(get_db),
    daemon: DaemonCredential = Depends(get_current_daemon),
):
    """Daemon polls this every 30s. If `paused: true`, daemon suspends Haiku."""
    # Re-read the current row in case the user toggled pause since the
    # bearer-token cred was loaded.
    stmt = select(DaemonCredential).where(
        DaemonCredential.daemon_id == daemon.daemon_id
    )
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()
    if not cred or cred.revoked_at is not None:
        # Treat revoked as paused — stops the daemon from doing work even if
        # we somehow pass the auth check.
        return PauseStatusResponse(paused=True, paused_until=None)

    paused = bool(cred.paused_until and cred.paused_until > datetime.utcnow())
    return PauseStatusResponse(
        paused=paused,
        paused_until=cred.paused_until.isoformat() if cred.paused_until else None,
    )
