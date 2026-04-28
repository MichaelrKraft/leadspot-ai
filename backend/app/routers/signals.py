"""Signals router — ingest, list, stream, soft-delete.

Mounted at prefix `/api`.

- POST   /signals                          (daemon)   ingest from daemon
- GET    /contacts/{id}/signals            (user)     timeline list
- GET    /contacts/{id}/signals/stream     (user)     SSE
- DELETE /signals/{signal_id}              (user)     soft-delete + tombstone

See plan §2.1, §2.2, §2.5.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker, get_db
from app.models import (
    DaemonCredential,
    EmailAlias,
    MergeRedirect,
    Signal,
    SignalTombstone,
    User,
)
from app.services.auth_service import get_current_user
from app.services.daemon_auth_service import get_current_daemon
from app.services.sse_publisher import publish_signal_inserted, subscribe_to_contact

logger = logging.getLogger(__name__)

CURRENT_SCHEMA_VERSION = 1

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class SignalIngestRequest(BaseModel):
    idempotency_key: str = Field(..., max_length=64)
    contact_match_key: str = Field(..., max_length=255)
    source: str
    source_app: Optional[str] = None
    extractor: str
    summary: str = Field(default="", max_length=512)
    confidence: int = Field(..., ge=0, le=100)
    observed_at: datetime
    ocr_snippet_hash: Optional[str] = Field(default=None, max_length=64)
    extras: Optional[dict[str, Any]] = None
    daemon_id: str
    schema_version: int = 1


class SignalIngestResponse(BaseModel):
    signal_id: str
    contact_id: Optional[str]
    state: str


class SignalTimelineEntry(BaseModel):
    id: str
    summary: str
    source_app: Optional[str] = None
    extractor: str
    observed_at: str
    confidence: int
    state: str
    ocr_snippet_hash: Optional[str] = None


class SignalTimelineResponse(BaseModel):
    signals: list[SignalTimelineEntry]
    next_before: Optional[str] = None


# =============================================================================
# Helpers
# =============================================================================

async def _resolve_contact_id(
    db: AsyncSession,
    organization_id: str,
    contact_match_key: str,
) -> Optional[str]:
    """Resolve contact_match_key -> contact_id, applying merge redirects.

    contact_match_key is opaque to us (could be an email_hash, "linkedin:slug",
    or "name:hash@org_hint"). For v1 we only resolve email_hash via EmailAlias.
    Other key formats fall through to None (orphan signal — will backfill if
    the user later creates the contact).

    Heuristic: a 64-char hex string is treated as a sha256 email_hash. Anything
    shorter or with non-hex chars is treated as a non-email key.
    """
    if not contact_match_key or len(contact_match_key) != 64:
        return None
    try:
        int(contact_match_key, 16)
    except ValueError:
        return None

    stmt = select(EmailAlias).where(
        EmailAlias.organization_id == organization_id,
        EmailAlias.email_hash == contact_match_key,
    )
    result = await db.execute(stmt)
    alias = result.scalar_one_or_none()
    if not alias:
        return None

    # Apply merge redirect if the matched contact was merged into another.
    redirect_stmt = select(MergeRedirect).where(
        MergeRedirect.organization_id == organization_id,
        MergeRedirect.old_contact_id == alias.contact_id,
    )
    redirect_result = await db.execute(redirect_stmt)
    redirect = redirect_result.scalar_one_or_none()
    if redirect:
        return redirect.new_contact_id

    return alias.contact_id


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/signals", response_model=SignalIngestResponse)
async def ingest_signal(
    body: SignalIngestRequest,
    db: AsyncSession = Depends(get_db),
    daemon: DaemonCredential = Depends(get_current_daemon),
):
    """Ingest a signal from the daemon. Idempotent on (org, idempotency_key)."""
    # 1. Daemon identity check — body.daemon_id MUST match the bearer token's
    # daemon. Otherwise daemon A could ingest signals labeled as from daemon B.
    if body.daemon_id != daemon.daemon_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="daemon_id in body does not match authenticated daemon.",
        )

    # 2. Schema version gate.
    if body.schema_version > CURRENT_SCHEMA_VERSION:
        raise HTTPException(
            status_code=status.HTTP_426_UPGRADE_REQUIRED,
            detail=f"Server schema_version is {CURRENT_SCHEMA_VERSION}; daemon sent {body.schema_version}.",
        )

    org_id = daemon.organization_id

    # 3. Idempotency: replay returns the existing row.
    dup_stmt = select(Signal).where(
        Signal.organization_id == org_id,
        Signal.idempotency_key == body.idempotency_key,
    )
    dup_result = await db.execute(dup_stmt)
    existing = dup_result.scalar_one_or_none()
    if existing:
        return SignalIngestResponse(
            signal_id=existing.id,
            contact_id=existing.contact_id,
            state=existing.state,
        )

    # 4. Resolve contact via email-hash alias + merge-redirect.
    contact_id = await _resolve_contact_id(db, org_id, body.contact_match_key)

    # 5. EU strict mode (plan §11.3): for users with eu_strict_mode = True,
    # do NOT store ocr_snippet_hash for UNMATCHED signals (contact_id IS NULL).
    # The hash is fine for matched signals because the contact already
    # consented to be in the CRM. We only fetch the user when there's a
    # snippet hash to potentially redact, to keep the hot path cheap.
    ocr_hash_to_store = body.ocr_snippet_hash
    if ocr_hash_to_store and contact_id is None:
        from app.models import User as _User
        u_stmt = select(_User).where(_User.user_id == daemon.user_id)
        u_result = await db.execute(u_stmt)
        owner = u_result.scalar_one_or_none()
        if owner is not None and bool(getattr(owner, "eu_strict_mode", False)):
            ocr_hash_to_store = None

    # 6. Persist.
    now = datetime.utcnow()
    signal = Signal(
        id=str(uuid.uuid4()),
        idempotency_key=body.idempotency_key,
        contact_id=contact_id,
        contact_match_key=body.contact_match_key,
        organization_id=org_id,
        source=body.source,
        source_app=body.source_app,
        extractor=body.extractor,
        summary=body.summary[:512],
        confidence=body.confidence,
        state="promoted",
        redaction_status="clean",
        observed_at=body.observed_at,
        created_at=now,
        promoted_at=now,
        daemon_id=daemon.daemon_id,
        schema_version=body.schema_version,
        extras=body.extras,
        ocr_snippet_hash=ocr_hash_to_store,
    )
    db.add(signal)

    # Update daemon last_seen — cheap, useful for the Devices UI.
    daemon.last_seen_at = now

    await db.flush()

    # 6. Notify SSE subscribers (best-effort; failure must not roll back ingest).
    try:
        await publish_signal_inserted(
            signal_id=signal.id,
            contact_id=contact_id,
            organization_id=org_id,
        )
    except Exception:
        logger.exception("Failed to publish signal_inserted event for %s", signal.id)

    return SignalIngestResponse(
        signal_id=signal.id,
        contact_id=contact_id,
        state=signal.state,
    )


@router.get("/contacts/{contact_id}/signals", response_model=SignalTimelineResponse)
async def list_contact_signals(
    contact_id: str,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[datetime] = Query(None, description="ISO timestamp; returns rows with observed_at < before"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Timeline-style listing of signals for a contact. Cursor by observed_at desc."""
    org_id = str(current_user.organization_id)

    stmt = (
        select(Signal)
        .where(
            Signal.organization_id == org_id,
            Signal.contact_id == contact_id,
            Signal.deleted_at.is_(None),
        )
        .order_by(Signal.observed_at.desc())
        .limit(limit)
    )
    if before is not None:
        stmt = stmt.where(Signal.observed_at < before)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    next_before = rows[-1].observed_at.isoformat() if len(rows) == limit else None

    return SignalTimelineResponse(
        signals=[
            SignalTimelineEntry(
                id=s.id,
                summary=s.summary,
                source_app=s.source_app,
                extractor=s.extractor,
                observed_at=s.observed_at.isoformat(),
                confidence=s.confidence,
                state=s.state,
                ocr_snippet_hash=s.ocr_snippet_hash,
            )
            for s in rows
        ],
        next_before=next_before,
    )


# -----------------------------------------------------------------------------
# SSE stream — note response_model is intentionally omitted: streaming responses
# can't be modeled by Pydantic (the body is an unbounded text/event-stream).
# We return a StreamingResponse directly. The lack of response_model is the
# documented exception to the rule.
# -----------------------------------------------------------------------------

async def _resolve_user_from_query_token(
    token: str,
) -> Optional[User]:
    """Validate a JWT passed via ?token= for SSE auth (EventSource can't set
    Authorization headers, and cookie auth is fine when same-origin but we
    accept token= for cross-origin cases too).
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") == "refresh":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        return result.scalar_one_or_none()


@router.get("/contacts/{contact_id}/signals/stream")
async def stream_contact_signals(
    contact_id: str,
    request: Request,
    token: Optional[str] = Query(default=None),
):
    """Server-Sent Events stream of new signals for a contact.

    EventSource doesn't support custom headers, so we accept either:
    - `?token=<jwt>` query param, or
    - `access_token` cookie (handled by get_current_user-style fallback)

    Heartbeat every 30s (`event: ping`) so proxies don't time out idle conns.
    """
    user: Optional[User] = None
    if token:
        user = await _resolve_user_from_query_token(token)

    if user is None:
        # Cookie fallback. Read access_token cookie and validate inline.
        cookie_token = request.cookies.get("access_token")
        if cookie_token:
            user = await _resolve_user_from_query_token(cookie_token)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication for SSE stream.",
        )

    org_id = str(user.organization_id)

    async def event_generator():
        # Initial comment so the client knows the stream is live.
        yield ": ok\n\n"
        last_heartbeat = asyncio.get_event_loop().time()

        try:
            async for payload in subscribe_to_contact(contact_id, org_id):
                if await request.is_disconnected():
                    break
                yield f"event: signal\ndata: {json.dumps(payload)}\n\n"

                now = asyncio.get_event_loop().time()
                if now - last_heartbeat >= 30:
                    yield "event: ping\ndata: \n\n"
                    last_heartbeat = now
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("SSE stream errored for contact_id=%s", contact_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.delete("/signals/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_signal(
    signal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """User-initiated drop. Soft-delete the signal and emit a tombstone so
    the daemon's local mirror invalidates it on the next /api/tombstones poll.
    """
    org_id = str(current_user.organization_id)

    stmt = select(Signal).where(
        Signal.id == signal_id,
        Signal.organization_id == org_id,
    )
    result = await db.execute(stmt)
    signal = result.scalar_one_or_none()
    if not signal or signal.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")

    signal.deleted_at = datetime.utcnow()

    tombstone = SignalTombstone(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        tombstone_type="signal",
        signal_id=signal_id,
        contact_id=signal.contact_id,
        reason="user-dropped",
        issued_at=datetime.utcnow(),
        issued_by_user_id=str(current_user.user_id),
    )
    db.add(tombstone)
    await db.flush()
