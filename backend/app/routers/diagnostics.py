"""Diagnostics router — daemon crash-report intake.

Mounted at prefix `/api`.

POST /diagnostics/crash — NO auth (daemons must be able to report when their
auth is broken). Rate-limited by stack hash (max 100 per stack hash per hour;
silently dropped beyond) so a crash loop can't fill the disk.

See plan §13.3 ("Crash reporting").
"""

import logging
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()


# Crash-report log lives in backend/logs/. Created on first call.
_LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
_LOG_FILE = _LOG_DIR / "daemon_crashes.log"

# In-memory rate limiter, keyed by stack hash. Stores list of timestamps in the
# trailing hour. Capped at 100 per key. Reset by natural expiry (we trim each
# call). The dict itself can grow unbounded across hashes; that's fine — at
# worst it's a few hundred KB until the process restarts.
_RATE_WINDOW_SECONDS = 3600
_RATE_MAX_PER_HOUR = 100
_recent: dict[str, list[float]] = defaultdict(list)


# =============================================================================
# Schemas
# =============================================================================

class CrashReportRequest(BaseModel):
    daemon_version: str = Field(default="", max_length=64)
    os_version: str = Field(default="", max_length=128)
    stack_trace: str = Field(default="", max_length=64_000)
    stack_hash: str = Field(default="", max_length=64)


# =============================================================================
# Helpers
# =============================================================================

def _is_rate_limited(stack_hash: str) -> bool:
    """Returns True if this stack hash has hit its hourly cap."""
    if not stack_hash:
        # No hash -> can't dedupe. Allow through but bucket under "anonymous".
        stack_hash = "_anonymous_"

    now = time.time()
    cutoff = now - _RATE_WINDOW_SECONDS
    bucket = _recent[stack_hash]

    # Trim old entries.
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)

    if len(bucket) >= _RATE_MAX_PER_HOUR:
        return True

    bucket.append(now)
    return False


def _ensure_log_dir() -> None:
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        # Don't crash on log-dir creation failures. Just log to stdout below.
        logger.exception("Failed to create crash-log directory %s", _LOG_DIR)


def _write_crash(report: CrashReportRequest) -> None:
    _ensure_log_dir()
    line = (
        f"[{datetime.utcnow().isoformat()}Z] "
        f"version={report.daemon_version!r} os={report.os_version!r} "
        f"hash={report.stack_hash!r} "
        f"stack={report.stack_trace!r}\n"
    )
    try:
        with _LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        logger.exception("Failed to write crash log to %s", _LOG_FILE)


# =============================================================================
# Endpoints
# =============================================================================

@router.post(
    "/diagnostics/crash",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def report_crash(body: CrashReportRequest) -> None:
    """Always returns 204. Don't reveal rate-limit state to the daemon — it
    would let a hostile caller probe the limit.

    NOTE: This endpoint intentionally has no `response_model`. FastAPI raises
    AssertionError when a 204 status is paired with response_model (a 204 by
    spec must not carry a body). All other endpoints in the Ghostlog routers
    do declare response_model per house style.
    """
    if not _is_rate_limited(body.stack_hash):
        _write_crash(body)
    return None
