"""DaemonTokenUsage model — per-user-per-day cost telemetry.

Cost telemetry is non-negotiable from day 1 (see plan §13, §15). Without it,
the per-user COGS at $39 ARPU is unmeasurable and the business model is at risk.

The daemon increments these counters via /api/daemon/cost/increment after every
Haiku call. The hard cap ($1.50/day Haiku) is enforced cloud-side: when the cap
is hit, the daemon receives a `cost_capped` flag in the next /version response
and stops calling Haiku until next day.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Index, Integer, String, UniqueConstraint

from app.database import Base


class DaemonTokenUsage(Base):
    __tablename__ = "daemon_token_usage"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False)
    user_id = Column(String(36), nullable=False)
    daemon_id = Column(String(36), nullable=False)
    day = Column(Date, nullable=False)
    haiku_tokens_input = Column(Integer, nullable=False, default=0)
    haiku_tokens_output = Column(Integer, nullable=False, default=0)
    sonnet_tokens_input = Column(Integer, nullable=False, default=0)
    sonnet_tokens_output = Column(Integer, nullable=False, default=0)
    signal_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "daemon_id", "day", name="ux_token_usage_user_day"),
        Index("ix_token_usage_day", "day"),
    )
