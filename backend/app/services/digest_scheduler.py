"""Per-process digest scheduler.

Wedge implementation: one `asyncio.create_task(loop_forever())` registered
in the FastAPI lifespan. Every 5 minutes it queries users whose timezone
makes "now" between 6:55am and 7:05am local, then builds + sends each
digest.

Production note: for a multi-process deployment we'd switch to APScheduler
with a Postgres jobstore (or a dedicated cron container). Per-process is
fine for one Render instance and avoids new infra dependencies for the
wedge. If we scale to >1 backend instance, two processes will each try to
fire the same digest — the fix is either (a) Postgres advisory lock keyed
on user_id+date, or (b) move scheduling out of the API process. We pick
the cheap path now.

See `tasks/ghostlog-integration-plan.md` §3 Phase 1 week 3.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select

from app.database import async_session_maker
from app.models import User
from app.services.digest_service import build_user_digest, send_digest

logger = logging.getLogger(__name__)


# Digest fires at 7am local. Window is +/- 5 min so a 5-minute polling cadence
# catches each user exactly once per day. (With a 5-min poll, the 10-min
# window means a user could fire twice if the loop runs at both 6:56 and 7:01.
# We dedupe via the once-per-(user, date) set in MEMORY below.)
DIGEST_HOUR_LOCAL = 7
DIGEST_WINDOW_MINUTES = 5

# How often the scheduler wakes up and checks. 5 min keeps the load trivial.
LOOP_INTERVAL_SECONDS = 300

# Per-process dedupe — (user_id, local_date) for users we already sent today.
# Cleared on day rollover. This is good enough for a single-process wedge;
# the production replacement (APScheduler with Postgres jobstore) will dedupe
# at the schedule layer.
_SENT_TODAY: set[tuple[str, str]] = set()
_SENT_TODAY_DATE: str | None = None


# =============================================================================
# Helpers
# =============================================================================

def _safe_zoneinfo(tz_name: str | None) -> ZoneInfo:
    """Fall back to UTC if tz_name is None/invalid. Bad TZ shouldn't crash the
    scheduler — it should silently default and we log a warning.
    """
    if not tz_name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        logger.warning("Unknown timezone %r — falling back to UTC for digest scheduling.", tz_name)
        return ZoneInfo("UTC")


def _is_in_digest_window(tz_name: str | None, now_utc: datetime | None = None) -> bool:
    """Return True if `now` in the user's local TZ is within +/-DIGEST_WINDOW_MINUTES of 7am."""
    tz = _safe_zoneinfo(tz_name)
    now_utc = now_utc or datetime.utcnow().replace(tzinfo=ZoneInfo("UTC"))
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=ZoneInfo("UTC"))
    local = now_utc.astimezone(tz)
    target = local.replace(hour=DIGEST_HOUR_LOCAL, minute=0, second=0, microsecond=0)
    delta_min = abs((local - target).total_seconds()) / 60
    return delta_min <= DIGEST_WINDOW_MINUTES


def _today_local(tz_name: str | None) -> str:
    tz = _safe_zoneinfo(tz_name)
    return datetime.now(tz).date().isoformat()


def _gc_sent_today() -> None:
    """If the day rolled over, clear the dedupe set."""
    global _SENT_TODAY, _SENT_TODAY_DATE
    today = datetime.utcnow().date().isoformat()
    if today != _SENT_TODAY_DATE:
        _SENT_TODAY.clear()
        _SENT_TODAY_DATE = today


# =============================================================================
# Loop
# =============================================================================

async def _run_one_pass() -> None:
    """One scheduler pass: find eligible users, build + send their digests."""
    _gc_sent_today()
    async with async_session_maker() as db:  # type: AsyncSession
        result = await db.execute(select(User))
        users = result.scalars().all()

        for user in users:
            tz_name = getattr(user, "timezone", None) or "America/Los_Angeles"
            if not _is_in_digest_window(tz_name):
                continue

            local_date = _today_local(tz_name)
            key = (str(user.user_id), local_date)
            if key in _SENT_TODAY:
                continue

            try:
                payload = await build_user_digest(str(user.user_id), db)
                await send_digest(user, payload, db)
                _SENT_TODAY.add(key)
                logger.info(
                    "Sent digest to user_id=%s mode=%s",
                    user.user_id,
                    payload.get("mode"),
                )
            except Exception:
                # One bad user must not stall the loop for the rest.
                logger.exception("Failed to send digest for user_id=%s", user.user_id)


async def _loop_forever() -> None:
    logger.info("Digest scheduler loop started (interval=%ss)", LOOP_INTERVAL_SECONDS)
    while True:
        try:
            await _run_one_pass()
        except Exception:
            # The pass-level handler should already have caught everything;
            # this is paranoia + log signal so we know the loop kept running.
            logger.exception("Digest scheduler pass crashed; continuing.")
        await asyncio.sleep(LOOP_INTERVAL_SECONDS)


# =============================================================================
# Public start/stop
# =============================================================================

_task: asyncio.Task | None = None


def start_digest_scheduler() -> None:
    """Spawn the scheduler task. Idempotent."""
    global _task
    if _task and not _task.done():
        return
    _task = asyncio.create_task(_loop_forever(), name="ghostlog-digest-scheduler")


async def stop_digest_scheduler() -> None:
    """Cancel the scheduler task on shutdown."""
    global _task
    if not _task:
        return
    _task.cancel()
    try:
        await _task
    except (asyncio.CancelledError, Exception):
        pass
    _task = None
