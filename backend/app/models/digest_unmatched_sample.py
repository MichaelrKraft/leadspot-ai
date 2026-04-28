"""DigestUnmatchedSample model — cloud-side proxy of the daemon's
unmatched_signals_log used by the cold-start morning digest.

The daemon doesn't push unmatched signals during steady ingest (privacy: we
never ship unrecognized people to the cloud). For the first 14 days (when
the user's mirror is sparse and most observed people aren't yet contacts),
the daemon POSTs a daily *sample* of up to 20 unmatched candidates so the
digest can prompt: "We saw 5 emails to people not yet in your CRM — review
and add?"

Rows have a 14-day TTL via `expires_at`. Pruning is opportunistic — the
digest query already filters by expires_at > now so stale rows don't
materially affect behavior.

See `tasks/ghostlog-integration-plan.md` §3 Phase 1 week 3 (cold-start digest).
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String

from app.database import Base


class DigestUnmatchedSample(Base):
    __tablename__ = "digest_unmatched_samples"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    daemon_id = Column(String(36), nullable=False)
    organization_id = Column(String(36), nullable=False)
    # contact_match_key is opaque (email_hash | "linkedin:slug" | "name:hash@org_hint").
    contact_match_key = Column(String(255), nullable=False)
    source_app = Column(String(120), nullable=True)
    summary = Column(String(512), nullable=False, default="")
    observed_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_digest_unmatched_org_expires", "organization_id", "expires_at"),
        Index("ix_digest_unmatched_daemon", "daemon_id"),
    )
