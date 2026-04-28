"""DaemonCredential model — per-Mac auth for the Ambient daemon.

Refresh-token rotation race fix: server tracks (refresh_token_hash, refresh_generation).
On /auth/daemon/refresh:
- Token matches current generation → issue new tokens, increment generation,
  store last_successor_token_hash + issued_at.
- Token matches previous generation AND within 60s grace → return the most-recent
  successor (idempotent), do NOT rotate again.
- Token older or mismatched → reject.

See `tasks/ghostlog-integration-plan.md` §2.4.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, SmallInteger, String

from app.database import Base


class DaemonCredential(Base):
    __tablename__ = "daemon_credentials"

    daemon_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False)
    user_id = Column(String(36), nullable=False)
    refresh_token_hash = Column(String(128), nullable=False)
    refresh_generation = Column(Integer, nullable=False, default=0)
    last_successor_token_hash = Column(String(128), nullable=True)
    last_successor_issued_at = Column(DateTime, nullable=True)
    device_label = Column(String(255), nullable=False, default="")
    user_email_at_auth = Column(String(255), nullable=False, default="")
    schema_version = Column(SmallInteger, nullable=False, default=1)
    last_seen_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Pause controls (plan §11, settings UI §A.2). When `paused_until` is in
    # the future the daemon should suspend Haiku calls. Use the year-3000 sentinel
    # for "pause indefinitely" so we can still query with a single filter.
    paused_until = Column(DateTime, nullable=True)
    pause_set_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_daemon_creds_org", "organization_id"),
        Index("ix_daemon_creds_user", "user_id"),
        Index("ix_daemon_creds_token_hash", "refresh_token_hash"),
    )
