"""Daemon cost telemetry router.

Mounted at prefix `/api/daemon`.

POST /cost/increment — daemon-auth. Upserts DaemonTokenUsage for (user_id,
daemon_id, day). Returns `cost_capped: bool` — when today's haiku tokens
exceed an env-tunable cap, daemon halts Haiku calls until next day.

See plan §13.4 (cost dashboard) and §15 (cost model).
"""

import logging
import os
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DaemonCredential, DaemonTokenUsage
from app.services.daemon_auth_service import get_current_daemon

logger = logging.getLogger(__name__)


def _haiku_token_cap() -> int:
    """Env-tunable. Default 1.5M tokens/day (~$1.50 at Haiku 4.5 pricing).

    Read at call time so tests / ops can adjust without restart of an in-flight
    process (settings.py would also work; we keep it simple here).
    """
    raw = os.getenv("LEADSPOT_HAIKU_DAILY_TOKEN_CAP", "1500000")
    try:
        return max(0, int(raw))
    except ValueError:
        return 1_500_000


router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class CostIncrementRequest(BaseModel):
    day: Optional[date] = Field(default=None, description="UTC date; defaults to today")
    haiku_tokens_input: int = Field(default=0, ge=0)
    haiku_tokens_output: int = Field(default=0, ge=0)
    sonnet_tokens_input: int = Field(default=0, ge=0)
    sonnet_tokens_output: int = Field(default=0, ge=0)
    signal_count: int = Field(default=0, ge=0)


class CostIncrementResponse(BaseModel):
    cost_capped: bool
    haiku_tokens_today: int
    cap: int


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/cost/increment", response_model=CostIncrementResponse)
async def increment_cost(
    body: CostIncrementRequest,
    db: AsyncSession = Depends(get_db),
    daemon: DaemonCredential = Depends(get_current_daemon),
):
    """Upsert today's usage row for this daemon and return the cap status.

    Upsert is implemented portably (SELECT then INSERT-or-UPDATE) so we don't
    depend on Postgres-only ON CONFLICT in dev SQLite.
    """
    target_day = body.day or datetime.utcnow().date()

    stmt = select(DaemonTokenUsage).where(
        DaemonTokenUsage.user_id == daemon.user_id,
        DaemonTokenUsage.daemon_id == daemon.daemon_id,
        DaemonTokenUsage.day == target_day,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if row is None:
        row = DaemonTokenUsage(
            id=str(uuid.uuid4()),
            organization_id=daemon.organization_id,
            user_id=daemon.user_id,
            daemon_id=daemon.daemon_id,
            day=target_day,
            haiku_tokens_input=body.haiku_tokens_input,
            haiku_tokens_output=body.haiku_tokens_output,
            sonnet_tokens_input=body.sonnet_tokens_input,
            sonnet_tokens_output=body.sonnet_tokens_output,
            signal_count=body.signal_count,
            updated_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        row.haiku_tokens_input = (row.haiku_tokens_input or 0) + body.haiku_tokens_input
        row.haiku_tokens_output = (row.haiku_tokens_output or 0) + body.haiku_tokens_output
        row.sonnet_tokens_input = (row.sonnet_tokens_input or 0) + body.sonnet_tokens_input
        row.sonnet_tokens_output = (row.sonnet_tokens_output or 0) + body.sonnet_tokens_output
        row.signal_count = (row.signal_count or 0) + body.signal_count
        row.updated_at = datetime.utcnow()

    await db.flush()

    # Per-user cap (NOT per-daemon): a user with two Macs shares the same
    # daily Haiku budget. Sum across all this user's daemons for today.
    # Plan §15: "$1.50/day Haiku per user."
    cap = _haiku_token_cap()
    user_total_stmt = select(
        func.coalesce(func.sum(DaemonTokenUsage.haiku_tokens_input), 0)
        + func.coalesce(func.sum(DaemonTokenUsage.haiku_tokens_output), 0)
    ).where(
        DaemonTokenUsage.user_id == daemon.user_id,
        DaemonTokenUsage.day == target_day,
    )
    user_total_result = await db.execute(user_total_stmt)
    haiku_today = int(user_total_result.scalar() or 0)
    cost_capped = cap > 0 and haiku_today >= cap

    return CostIncrementResponse(
        cost_capped=cost_capped,
        haiku_tokens_today=haiku_today,
        cap=cap,
    )
