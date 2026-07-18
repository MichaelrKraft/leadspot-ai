
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
from app.models.contact import Contact
from app.models.email import Email
from app.models.email_message import EmailMessage
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

# Derived email-thread conversation ids are prefixed to distinguish them from
# Conversation-table UUIDs (which continue to back SMS + manual compose).
EMAIL_THREAD_PREFIX = "em:"


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
    contact_id: str | None
    contact_name: str
    contact_email: str | None
    contact_phone: str | None
    subject: str | None
    last_message: str
    last_message_at: str
    unread_count: int
    org_id: str
    created_at: str
    category: str | None = None  # triage category for email threads

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
    sender_name: str | None

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
    contact_id: str | None = None
    contact_name: str
    contact_email: str | None = None
    contact_phone: str | None = None
    subject: str | None = None
    first_message: str | None = None


class ReplyBody(BaseModel):
    body: str


class CategoryCorrectionBody(BaseModel):
    category: str
    always_for_sender: bool = False


# ---------------------------------------------------------------------------
# Email-thread derivation (Unified Inbox)
# ---------------------------------------------------------------------------


def _thread_key(m: EmailMessage) -> str:
    return m.thread_id or m.provider_message_id


async def _contact_names(db: AsyncSession, org_id: str, contact_ids: set[str]) -> dict[str, str]:
    if not contact_ids:
        return {}
    contacts = (
        await db.execute(
            select(Contact).where(
                Contact.organization_id == org_id, Contact.id.in_(contact_ids)
            )
        )
    ).scalars().all()
    return {
        c.id: f"{c.first_name} {c.last_name}".strip() for c in contacts
    }


def _email_thread_out(
    thread: list[EmailMessage], names: dict[str, str]
) -> ConversationOut:
    """Collapse one email thread (oldest->newest) into a ConversationOut."""
    latest = thread[-1]
    first = thread[0]
    inbound = next((m for m in reversed(thread) if m.direction == "inbound"), latest)
    contact_id = next((m.contact_id for m in thread if m.contact_id), None)
    return ConversationOut(
        id=f"{EMAIL_THREAD_PREFIX}{_thread_key(latest)}",
        type="email",
        contact_id=contact_id,
        contact_name=(names.get(contact_id) if contact_id else None) or inbound.from_address,
        contact_email=inbound.from_address,
        contact_phone=None,
        subject=first.subject,
        last_message=(latest.body_preview or "")[:2000],
        last_message_at=latest.received_at.isoformat() if latest.received_at else "",
        unread_count=0,  # read-state is CRM-local and lands with Phase D-full
        org_id=latest.org_id,
        created_at=first.received_at.isoformat() if first.received_at else "",
        category=latest.category,
    )


async def _load_thread(
    db: AsyncSession, org_id: str, thread_key: str
) -> list[EmailMessage]:
    rows = (
        await db.execute(
            select(EmailMessage)
            .where(
                EmailMessage.org_id == org_id,
                (EmailMessage.thread_id == thread_key)
                | (EmailMessage.provider_message_id == thread_key),
            )
            .order_by(EmailMessage.received_at.asc())
        )
    ).scalars().all()
    return list(rows)


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
    """List conversations: email threads derived from ingested mail, plus
    SMS/manual conversations from the legacy Conversation table."""
    org_id = str(current_user.organization_id)
    conversations: list[ConversationOut] = []

    if type in ("all", "email"):
        # Group recent mail into threads. Fetch a window of recent messages and
        # collapse in memory — fine at CRM inbox scale, avoids dialect-specific
        # window functions across SQLite/PostgreSQL.
        rows = (
            await db.execute(
                select(EmailMessage)
                .where(EmailMessage.org_id == org_id)
                .order_by(EmailMessage.received_at.desc())
                .limit(limit * 10)
            )
        ).scalars().all()
        threads: dict[str, list[EmailMessage]] = {}
        for m in rows:
            threads.setdefault(_thread_key(m), []).append(m)
        names = await _contact_names(
            db, org_id, {m.contact_id for m in rows if m.contact_id}
        )
        for thread in threads.values():
            thread.sort(key=lambda m: m.received_at or datetime.min)
            conversations.append(_email_thread_out(thread, names))

    if type in ("all", "sms", "chat"):
        stmt = select(Conversation).where(Conversation.org_id == org_id)
        if type != "all":
            stmt = stmt.where(Conversation.type == type)
        else:
            stmt = stmt.where(Conversation.type != "email")
        legacy = (await db.execute(stmt)).scalars().all()
        conversations.extend(ConversationOut.from_orm(c) for c in legacy)

    conversations.sort(key=lambda c: c.last_message_at, reverse=True)
    start = (page - 1) * limit
    return {
        "conversations": conversations[start : start + limit],
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

    if conversation_id.startswith(EMAIL_THREAD_PREFIX):
        thread_key = conversation_id[len(EMAIL_THREAD_PREFIX):]
        thread = await _load_thread(db, org_id, thread_key)
        if not thread:
            raise HTTPException(status_code=404, detail="Conversation not found")
        names = await _contact_names(
            db, org_id, {m.contact_id for m in thread if m.contact_id}
        )
        messages = [
            MessageOut(
                id=m.id,
                conversation_id=conversation_id,
                direction="outbound" if m.direction == "outbound" else "inbound",
                body=m.body_preview or "",
                sent_at=m.received_at.isoformat() if m.received_at else "",
                sender_name=m.from_address,
            )
            for m in thread
        ]
        return {
            "conversation": _email_thread_out(thread, names),
            "messages": messages,
        }

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


@router.get("/meta/categories")
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The org's triage categories (seeded on first use) — for chips/dropdowns."""
    from app.services.inference.email_classifier import ensure_categories

    org_id = str(current_user.organization_id)
    categories = await ensure_categories(db, org_id)
    return {
        "categories": [
            {
                "name": c.name,
                "description": c.description,
                "enabled": c.enabled,
                "drafts_enabled": c.drafts_enabled,
            }
            for c in categories
        ]
    }


@router.patch("/{conversation_id}/category")
async def correct_category(
    conversation_id: str,
    body: CategoryCorrectionBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Correct an email thread's category — the triage feedback loop.

    Optionally writes a sender rule so future mail from this sender is
    categorized the same way without the LLM.
    """
    from app.models.email_category import EmailCategory, SenderRule

    if not conversation_id.startswith(EMAIL_THREAD_PREFIX):
        raise HTTPException(status_code=400, detail="Only email threads have categories")

    org_id = str(current_user.organization_id)
    valid = (
        await db.execute(
            select(EmailCategory).where(
                EmailCategory.org_id == org_id, EmailCategory.name == body.category
            )
        )
    ).scalar_one_or_none()
    if not valid:
        raise HTTPException(status_code=422, detail="Unknown category")

    thread_key = conversation_id[len(EMAIL_THREAD_PREFIX):]
    thread = await _load_thread(db, org_id, thread_key)
    if not thread:
        raise HTTPException(status_code=404, detail="Conversation not found")

    for m in thread:
        if m.direction == "inbound":
            m.category = body.category

    rule_created = False
    if body.always_for_sender:
        sender = next(
            (m.from_address for m in reversed(thread) if m.direction == "inbound"), None
        )
        if sender:
            existing = (
                await db.execute(
                    select(SenderRule).where(
                        SenderRule.org_id == org_id, SenderRule.pattern == sender.lower()
                    )
                )
            ).scalar_one_or_none()
            if existing:
                existing.category_name = body.category
            else:
                db.add(
                    SenderRule(
                        org_id=org_id, pattern=sender.lower(), category_name=body.category
                    )
                )
            rule_created = True

    await db.commit()
    return {"ok": True, "category": body.category, "sender_rule_created": rule_created}


@router.post("/{conversation_id}/reply")
async def reply_to_conversation(
    conversation_id: str,
    body: ReplyBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an outbound reply message to a conversation.

    For derived email threads the reply is saved as a Draft in the emails
    table — nothing is sent (sending is the agent-service's job once its
    send path ships). The draft is returned in message shape so the UI can
    render it optimistically.
    """
    if not body.body.strip():
        raise HTTPException(status_code=422, detail="Reply body cannot be empty")

    org_id = str(current_user.organization_id)

    if conversation_id.startswith(EMAIL_THREAD_PREFIX):
        thread_key = conversation_id[len(EMAIL_THREAD_PREFIX):]
        thread = await _load_thread(db, org_id, thread_key)
        if not thread:
            raise HTTPException(status_code=404, detail="Conversation not found")
        latest_inbound = next(
            (m for m in reversed(thread) if m.direction == "inbound"), thread[-1]
        )
        now = datetime.utcnow()
        draft = Email(
            id=_uuid(),
            subject=f"Re: {latest_inbound.subject or ''}".strip(),
            status="Draft",
            from_addr=getattr(current_user, "email", "") or "",
            to_addr=latest_inbound.from_address,
            body=body.body.strip(),
            email_type="Outbound",
            contact_id=latest_inbound.contact_id,
            user_id=str(current_user.user_id),
        )
        db.add(draft)
        await db.commit()
        return {
            "message": MessageOut(
                id=draft.id,
                conversation_id=conversation_id,
                direction="outbound",
                body=draft.body or "",
                sent_at=now.isoformat(),
                sender_name=getattr(current_user, "full_name", None),
            )
        }

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
