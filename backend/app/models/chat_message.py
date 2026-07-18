"""Conversation history for the /api/v2/chat conversational AI.

One row per user or assistant turn, keyed by thread_id. Replayed into the
Claude call so follow-up questions have context. Tool-use blocks are NOT
persisted — only the user's text and the assistant's final text — which keeps
rows small and replay cheap.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String, Text

from app.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False)
    user_id = Column(String(36), nullable=False)
    thread_id = Column(String(36), nullable=False)
    role = Column(String(20), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_chat_messages_thread_created", "thread_id", "created_at"),
        Index("ix_chat_messages_org_thread", "organization_id", "thread_id"),
    )
