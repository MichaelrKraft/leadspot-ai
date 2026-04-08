from typing import Optional
"""
Conversations router — inbox email/SMS threads.
Backed by SQLite via SQLAlchemy async session.
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, get_db
from app.models import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


# ---------------------------------------------------------------------------
# SQLAlchemy models
# ---------------------------------------------------------------------------


def _uuid() -> str:
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=_uuid, index=True)
    type = Column(String(10), nullable=False, default="email")  # email | sms
    contact_id = Column(String(36), nullable=True)
    contact_name = Column(String(255), nullable=False, default="")
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    subject = Column(String(500), nullable=True)
    last_message = Column(String(2000), nullable=False, default="")
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    unread_count = Column(Integer, default=0, nullable=False)
    org_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(String(36), primary_key=True, default=_uuid, index=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    direction = Column(String(10), nullable=False, default="inbound")  # inbound | outbound
    body = Column(String(5000), nullable=False, default="")
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sender_name = Column(String(255), nullable=True)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ConversationOut(BaseModel):
    id: str
    type: str
    contact_id: Optional[str]
    contact_name: str
    contact_email: Optional[str]
    contact_phone: Optional[str]
    subject: Optional[str]
    last_message: str
    last_message_at: str
    unread_count: int
    org_id: str
    created_at: str

    @classmethod
    def from_orm(cls, c: Conversation) -> "ConversationOut":
        return cls(
            id=c.id,
            type=c.type,
            contact_id=c.contact_id,
            contact_name=c.contact_name,
            contact_email=c.contact_email,
            contact_phone=c.contact_phone,
            subject=c.subject,
            last_message=c.last_message,
            last_message_at=c.last_message_at.isoformat() if c.last_message_at else "",
            unread_count=c.unread_count,
            org_id=c.org_id,
            created_at=c.created_at.isoformat() if c.created_at else "",
        )


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    direction: str
    body: str
    sent_at: str
    sender_name: Optional[str]

    @classmethod
    def from_orm(cls, m: ConversationMessage) -> "MessageOut":
        return cls(
            id=m.id,
            conversation_id=m.conversation_id,
            direction=m.direction,
            body=m.body,
            sent_at=m.sent_at.isoformat() if m.sent_at else "",
            sender_name=m.sender_name,
        )


class CreateConversationBody(BaseModel):
    type: str = "email"
    contact_id: Optional[str] = None
    contact_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    subject: Optional[str] = None
    first_message: Optional[str] = None


class ReplyBody(BaseModel):
    body: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_conversations(
    type: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List conversations for the org, optionally filtered by type."""
    org_id = str(current_user.organization_id)
    stmt = select(Conversation).where(Conversation.org_id == org_id)
    if type != "all":
        stmt = stmt.where(Conversation.type == type)
    stmt = stmt.order_by(Conversation.last_message_at.desc())
    stmt = stmt.offset((page - 1) * limit).limit(limit)

    result = await db.execute(stmt)
    convos = result.scalars().all()

    return {
        "conversations": [ConversationOut.from_orm(c) for c in convos],
        "page": page,
        "limit": limit,
    }


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single conversation and its messages."""
    org_id = str(current_user.organization_id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.org_id == org_id,
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs_result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.sent_at.asc())
    )
    messages = msgs_result.scalars().all()

    return {
        "conversation": ConversationOut.from_orm(convo),
        "messages": [MessageOut.from_orm(m) for m in messages],
    }


@router.post("")
async def create_conversation(
    body: CreateConversationBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation, optionally with a first message."""
    org_id = str(current_user.organization_id)
    now = datetime.utcnow()

    convo = Conversation(
        id=_uuid(),
        type=body.type,
        contact_id=body.contact_id,
        contact_name=body.contact_name,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        subject=body.subject,
        last_message=body.first_message or "",
        last_message_at=now,
        unread_count=0,
        org_id=org_id,
        created_at=now,
    )
    db.add(convo)

    if body.first_message:
        msg = ConversationMessage(
            id=_uuid(),
            conversation_id=convo.id,
            direction="outbound",
            body=body.first_message,
            sent_at=now,
            sender_name=current_user.full_name if hasattr(current_user, "full_name") else None,
        )
        db.add(msg)

    await db.commit()
    await db.refresh(convo)

    return {"conversation": ConversationOut.from_orm(convo)}


@router.post("/{conversation_id}/reply")
async def reply_to_conversation(
    conversation_id: str,
    body: ReplyBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an outbound reply message to a conversation."""
    if not body.body.strip():
        raise HTTPException(status_code=422, detail="Reply body cannot be empty")

    org_id = str(current_user.organization_id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.org_id == org_id,
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = datetime.utcnow()
    msg = ConversationMessage(
        id=_uuid(),
        conversation_id=conversation_id,
        direction="outbound",
        body=body.body.strip(),
        sent_at=now,
        sender_name=current_user.full_name if hasattr(current_user, "full_name") else None,
    )
    db.add(msg)

    # Update conversation's last message snapshot
    convo.last_message = body.body.strip()[:200]
    convo.last_message_at = now

    await db.commit()
    await db.refresh(msg)

    return {"message": MessageOut.from_orm(msg)}
