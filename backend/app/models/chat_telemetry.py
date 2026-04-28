"""ChatTelemetry model — hallucination + citation telemetry for the
Phase 3 Conversational AI layer.

Logs one row per assistant turn so we can answer:
  * "% of factual replies that cited at least one signal_id"
  * "How often does the citation guard trigger a re-prompt?"
  * "Which model produced the response (haiku vs sonnet)?"

Why a separate table from `daemon_token_usage`:
- daemon_token_usage is per-day rollups for the screen-capture daemon's
  Haiku spend; it's keyed (user_id, daemon_id, day).
- chat_telemetry is per-turn rows keyed by message_id, with citation
  detail. Mixing rollups with raw turn rows would muddy both queries.

See `tasks/ghostlog-integration-plan.md` §6 success metrics:
  "100% of factual claims cite >= 1 signal_id"
  "0 hallucinated contact facts"
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String

from app.database import Base


class ChatTelemetry(Base):
    __tablename__ = "chat_telemetry"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False)
    user_id = Column(String(36), nullable=False)
    thread_id = Column(String(36), nullable=False)
    model = Column(String(60), nullable=False)
    has_citations = Column(Boolean, nullable=False, default=False)
    num_signal_ids = Column(Integer, nullable=False, default=0)
    triggered_citation_guard = Column(Boolean, nullable=False, default=False)
    tokens_input = Column(Integer, nullable=False, default=0)
    tokens_output = Column(Integer, nullable=False, default=0)
    is_deep = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_chat_telemetry_org_created", "organization_id", "created_at"),
        Index("ix_chat_telemetry_thread", "thread_id"),
        Index("ix_chat_telemetry_user_created", "user_id", "created_at"),
    )
