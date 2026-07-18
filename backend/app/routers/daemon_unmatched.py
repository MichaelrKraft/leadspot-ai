"""Daemon unmatched-samples router.

Mounted at prefix `/api/daemon`.

POST /unmatched/sample — daemon-auth. The daemon POSTs up to 50 sampled
unmatched candidates from its local `unmatched_signals_log` so the
cold-start morning digest (first 14 days) can render: "We saw N emails to
people not yet in your CRM — review and add?"

Rows are stored cloud-side with a 14-day TTL (expires_at). The digest query
filters on expires_at > now, so stale rows are functionally invisible even
if not yet pruned.

See `tasks/ghostlog-integration-plan.md` §3 Phase 1 week 3.
"""

import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DaemonCredential, DigestUnmatchedSample
from app.services.daemon_auth_service import get_current_daemon

logger = logging.getLogger(__name__)


# Per-call cap so a misbehaving daemon can't flood the table.
MAX_SAMPLES_PER_CALL = 50

# TTL for cold-start digest samples. Aligned with the 14-day cold-start window
# in the plan (§3 Phase 1 week 3). Slightly longer than 14 days so a digest
# generated at the end of day 14 still has fresh data.
SAMPLE_TTL_DAYS = 14


router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class UnmatchedSampleItem(BaseModel):
    contact_match_key: str = Field(..., max_length=255)
    source_app: str | None = Field(default=None, max_length=120)
    summary: str = Field(default="", max_length=512)
    observed_at: datetime


class UnmatchedSampleRequest(BaseModel):
    samples: list[UnmatchedSampleItem]


class UnmatchedSampleResponse(BaseModel):
    accepted: int
    rejected: int


# =============================================================================
# Endpoint
# =============================================================================

@router.post("/unmatched/sample", response_model=UnmatchedSampleResponse)
async def post_unmatched_sample(
    body: UnmatchedSampleRequest,
    db: AsyncSession = Depends(get_db),
    daemon: DaemonCredential = Depends(get_current_daemon),
):
    """Accept a sample batch of unmatched candidates from the daemon.

    Cap: 50 samples per call. Anything beyond is dropped (no error — the
    daemon doesn't need to retry; tomorrow's batch will be a fresh sample).
    """
    if not body.samples:
        return UnmatchedSampleResponse(accepted=0, rejected=0)

    incoming = body.samples[:MAX_SAMPLES_PER_CALL]
    rejected = max(0, len(body.samples) - MAX_SAMPLES_PER_CALL)

    now = datetime.utcnow()
    expires = now + timedelta(days=SAMPLE_TTL_DAYS)

    accepted = 0
    for item in incoming:
        # Reject empty match_keys defensively — the daemon shouldn't send
        # these, but a corrupt batch shouldn't pollute the table.
        if not item.contact_match_key:
            rejected += 1
            continue
        row = DigestUnmatchedSample(
            id=str(uuid.uuid4()),
            daemon_id=daemon.daemon_id,
            organization_id=daemon.organization_id,
            contact_match_key=item.contact_match_key[:255],
            source_app=item.source_app,
            summary=(item.summary or "")[:512],
            observed_at=item.observed_at,
            expires_at=expires,
            created_at=now,
        )
        db.add(row)
        accepted += 1

    daemon.last_seen_at = now
    await db.flush()

    return UnmatchedSampleResponse(accepted=accepted, rejected=rejected)
