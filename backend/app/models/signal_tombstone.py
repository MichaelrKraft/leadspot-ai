"""SignalTombstone model — drop-replication to daemons.

Cloud-side soft-deletes propagate to daemons via this table. The daemon polls
GET /api/tombstones?since=<cursor> on every promotion cycle and applies them
locally (mirror invalidation, signal soft-delete, RTBF email-hash purge).

Types:
- 'signal'        — drop one specific signal_id
- 'contact'       — cascade: drop all signals for a contact_id
- 'email_hash'    — RTBF: purge all signals matching a hashed email
- 'subscription'  — cancel/refund: purge all org signals after grace

See `tasks/ghostlog-integration-plan.md` §2.2, §11 (RTBF), §14 (lifecycle).
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Index, String

from app.database import Base


TOMBSTONE_TYPES = ("signal", "contact", "email_hash", "subscription")


class SignalTombstone(Base):
    __tablename__ = "signal_tombstones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False)
    tombstone_type = Column(String(30), nullable=False)
    signal_id = Column(String(36), nullable=True)
    contact_id = Column(String(36), nullable=True)
    email_hash = Column(String(64), nullable=True)
    reason = Column(String(120), nullable=True)
    issued_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    issued_by_user_id = Column(String(36), nullable=True)

    __table_args__ = (
        Index("ix_tombstones_org_issued", "organization_id", "issued_at"),
        CheckConstraint(
            "tombstone_type IN ('signal','contact','email_hash','subscription')",
            name="ck_tombstones_type",
        ),
    )
