"""Signal model — the unifying primitive for Ghostlog.

A Signal is a redacted, sourced observation about a contact:
"person X was seen in context Y at time Z." Daemon SQLite and
cloud Postgres carry near-mirror schemas; daemon is staging,
cloud is system of record.

See `tasks/ghostlog-integration-plan.md` §2.1 for full design rationale.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
)

from app.database import Base


SIGNAL_STATES = (
    "captured", "enriched", "matched", "queued",
    "promoted", "held", "dropped", "redacted",
)
SIGNAL_SOURCES = ("ambient_screen", "dockable_transcript", "manual")
REDACTION_STATUSES = ("clean", "pii_stripped", "rejected")


class Signal(Base):
    __tablename__ = "signals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key = Column(String(64), nullable=False)
    contact_id = Column(String(36), nullable=True)
    contact_match_key = Column(String(255), nullable=False)
    organization_id = Column(String(36), nullable=False)
    source = Column(String(40), nullable=False)
    source_app = Column(String(120), nullable=True)
    extractor = Column(String(60), nullable=False)
    summary = Column(String(512), nullable=False, default="")
    confidence = Column(SmallInteger, nullable=False, default=0)
    state = Column(String(20), nullable=False, default="captured")
    redaction_status = Column(String(20), nullable=False, default="clean")
    observed_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    promoted_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    daemon_id = Column(String(36), nullable=False)
    schema_version = Column(SmallInteger, nullable=False, default=1)
    extras = Column(JSON, nullable=True)
    ocr_snippet_hash = Column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="ux_signals_org_idempotency"),
        Index("ix_signals_contact_observed", "contact_id", "observed_at"),
        Index("ix_signals_org_state", "organization_id", "state"),
        Index("ix_signals_daemon", "daemon_id"),
        Index("ix_signals_match_key", "organization_id", "contact_match_key"),
        CheckConstraint(
            "state IN ('captured','enriched','matched','queued','promoted','held','dropped','redacted')",
            name="ck_signals_state",
        ),
        CheckConstraint(
            "source IN ('ambient_screen','dockable_transcript','manual')",
            name="ck_signals_source",
        ),
        CheckConstraint(
            "redaction_status IN ('clean','pii_stripped','rejected')",
            name="ck_signals_redaction",
        ),
        CheckConstraint(
            "confidence BETWEEN 0 AND 100",
            name="ck_signals_confidence",
        ),
    )
