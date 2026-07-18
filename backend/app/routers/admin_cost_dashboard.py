"""Admin cost dashboard router.

Mounted at prefix `/api/admin`.

GET /api/admin/cost-dashboard?days=30 — admin/superadmin role required.

Returns per-user Haiku/Sonnet token usage over a time window plus rough
USD estimates and per-day cap-hit counts. Backs the superadmin
/cost-dashboard page (plan §13.4).
"""

import logging
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DaemonCredential, DaemonTokenUsage, User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


_ADMIN_ROLES = {"admin", "superadmin"}


# Anthropic pricing (Haiku 4.5, public list price as of plan-draft time).
# These are coarse estimates — final billing reconciliation should pull from
# Anthropic's usage API. The dashboard's purpose is to spot outliers, not
# generate invoices.
_HAIKU_USD_PER_1M_INPUT = 1.00
_HAIKU_USD_PER_1M_OUTPUT = 5.00
_SONNET_USD_PER_1M_INPUT = 3.00
_SONNET_USD_PER_1M_OUTPUT = 15.00


def _haiku_token_cap() -> int:
    """Mirror of daemon_cost._haiku_token_cap() — kept local to avoid coupling.

    A small duplication is cheaper than threading a shared module just for
    one constant that may diverge later (admin cap may differ from daemon cap).
    """
    raw = os.getenv("LEADSPOT_HAIKU_DAILY_TOKEN_CAP", "1500000")
    try:
        return max(0, int(raw))
    except ValueError:
        return 1_500_000


# =============================================================================
# Schemas
# =============================================================================

class UserCostRow(BaseModel):
    user_id: str
    email: str
    haiku_tokens_today: int
    haiku_tokens_30d: int
    sonnet_tokens_30d: int
    estimated_cost_30d_usd: float
    cap_hits_30d: int
    daemon_count: int


class CostTotals(BaseModel):
    user_count: int
    haiku_tokens_30d: int
    sonnet_tokens_30d: int
    estimated_cost_30d_usd: float
    cap: int


class CostDashboardResponse(BaseModel):
    users: list[UserCostRow]
    totals: CostTotals
    days: int


# =============================================================================
# Endpoint
# =============================================================================

@router.get("/cost-dashboard", response_model=CostDashboardResponse)
async def cost_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-user cost rollup over the last `days` days.

    Admin-only. Sum is computed across all daemons of each user (a user with
    two Macs is one row). Sorted by `haiku_tokens_30d` descending so the
    biggest spenders are at the top — the only sort that's actually useful
    when looking for outliers.
    """
    if (current_user.role or "") not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin or superadmin role required",
        )

    today = datetime.utcnow().date()
    window_start = today - timedelta(days=days - 1)

    # 1. Aggregate window-spanning rollup per user.
    haiku_in = func.coalesce(func.sum(DaemonTokenUsage.haiku_tokens_input), 0)
    haiku_out = func.coalesce(func.sum(DaemonTokenUsage.haiku_tokens_output), 0)
    sonnet_in = func.coalesce(func.sum(DaemonTokenUsage.sonnet_tokens_input), 0)
    sonnet_out = func.coalesce(func.sum(DaemonTokenUsage.sonnet_tokens_output), 0)

    rollup_stmt = (
        select(
            DaemonTokenUsage.user_id.label("user_id"),
            haiku_in.label("haiku_in"),
            haiku_out.label("haiku_out"),
            sonnet_in.label("sonnet_in"),
            sonnet_out.label("sonnet_out"),
        )
        .where(DaemonTokenUsage.day >= window_start)
        .group_by(DaemonTokenUsage.user_id)
    )
    rollup_result = await db.execute(rollup_stmt)
    rollup_rows = rollup_result.all()

    # 2. Today-only Haiku tokens per user (to highlight users near the cap).
    today_stmt = (
        select(
            DaemonTokenUsage.user_id.label("user_id"),
            (haiku_in + haiku_out).label("haiku_today"),
        )
        .where(DaemonTokenUsage.day == today)
        .group_by(DaemonTokenUsage.user_id)
    )
    today_result = await db.execute(today_stmt)
    today_map: dict[str, int] = {row.user_id: int(row.haiku_today) for row in today_result.all()}

    # 3. Cap-hit count: count days where the user exceeded the cap.
    # Compute Haiku-tokens-by-day per user then count days >= cap.
    cap = _haiku_token_cap()
    cap_hits_map: dict[str, int] = {}
    if cap > 0:
        per_day_stmt = (
            select(
                DaemonTokenUsage.user_id.label("user_id"),
                DaemonTokenUsage.day.label("day"),
                (haiku_in + haiku_out).label("haiku_day"),
            )
            .where(DaemonTokenUsage.day >= window_start)
            .group_by(DaemonTokenUsage.user_id, DaemonTokenUsage.day)
        )
        per_day_result = await db.execute(per_day_stmt)
        for row in per_day_result.all():
            if int(row.haiku_day) >= cap:
                cap_hits_map[row.user_id] = cap_hits_map.get(row.user_id, 0) + 1

    # 4. Daemon count per user (active, non-revoked).
    daemon_count_stmt = (
        select(
            DaemonCredential.user_id.label("user_id"),
            func.count(DaemonCredential.daemon_id).label("daemon_count"),
        )
        .where(DaemonCredential.revoked_at.is_(None))
        .group_by(DaemonCredential.user_id)
    )
    daemon_result = await db.execute(daemon_count_stmt)
    daemon_count_map: dict[str, int] = {row.user_id: int(row.daemon_count) for row in daemon_result.all()}

    # 5. Resolve emails for the user_ids we collected.
    user_ids = {row.user_id for row in rollup_rows}
    user_ids.update(daemon_count_map.keys())
    email_map: dict[str, str] = {}
    if user_ids:
        users_stmt = select(User.user_id, User.email).where(User.user_id.in_(list(user_ids)))
        users_result = await db.execute(users_stmt)
        email_map = {uid: email for uid, email in users_result.all()}

    # 6. Build response rows. We include users that appear in either rollup
    # or daemon-count map so a user with daemons but zero spend is visible.
    rollup_map = {row.user_id: row for row in rollup_rows}
    all_user_ids = set(rollup_map.keys()) | set(daemon_count_map.keys())

    rows: list[UserCostRow] = []
    total_haiku_in = total_haiku_out = total_sonnet_in = total_sonnet_out = 0
    for uid in all_user_ids:
        row = rollup_map.get(uid)
        h_in = int(row.haiku_in) if row else 0
        h_out = int(row.haiku_out) if row else 0
        s_in = int(row.sonnet_in) if row else 0
        s_out = int(row.sonnet_out) if row else 0

        total_haiku_in += h_in
        total_haiku_out += h_out
        total_sonnet_in += s_in
        total_sonnet_out += s_out

        cost = (
            (h_in / 1_000_000) * _HAIKU_USD_PER_1M_INPUT
            + (h_out / 1_000_000) * _HAIKU_USD_PER_1M_OUTPUT
            + (s_in / 1_000_000) * _SONNET_USD_PER_1M_INPUT
            + (s_out / 1_000_000) * _SONNET_USD_PER_1M_OUTPUT
        )

        rows.append(
            UserCostRow(
                user_id=uid,
                email=email_map.get(uid, "(unknown)"),
                haiku_tokens_today=today_map.get(uid, 0),
                haiku_tokens_30d=h_in + h_out,
                sonnet_tokens_30d=s_in + s_out,
                estimated_cost_30d_usd=round(cost, 4),
                cap_hits_30d=cap_hits_map.get(uid, 0),
                daemon_count=daemon_count_map.get(uid, 0),
            )
        )

    rows.sort(key=lambda r: r.haiku_tokens_30d, reverse=True)

    total_cost = (
        (total_haiku_in / 1_000_000) * _HAIKU_USD_PER_1M_INPUT
        + (total_haiku_out / 1_000_000) * _HAIKU_USD_PER_1M_OUTPUT
        + (total_sonnet_in / 1_000_000) * _SONNET_USD_PER_1M_INPUT
        + (total_sonnet_out / 1_000_000) * _SONNET_USD_PER_1M_OUTPUT
    )

    return CostDashboardResponse(
        users=rows,
        totals=CostTotals(
            user_count=len(rows),
            haiku_tokens_30d=total_haiku_in + total_haiku_out,
            sonnet_tokens_30d=total_sonnet_in + total_sonnet_out,
            estimated_cost_30d_usd=round(total_cost, 4),
            cap=cap,
        ),
        days=days,
    )
