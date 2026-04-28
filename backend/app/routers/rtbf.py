"""Right-to-be-forgotten — user-facing endpoint.

Mounted at prefix `/api`.

POST /api/contacts/forget — Any authenticated user can purge a contact's
data within their OWN org (org-scoped). This complements the admin-only
POST /admin/purge which takes an email_hash and is intended for support
operators handling tickets across orgs.

Body: {"email": "<plaintext email>", "reason": "<optional>"}.
The plaintext email is normalized + hashed server-side; the daemon and
all org-mates see a tombstone with the resulting email_hash.

See plan §11.2 (right-to-be-forgotten flow) and §11.5 (CCPA parallels).
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EmailAlias, Signal, SignalTombstone, User
from app.services.auth_service import get_current_user
from app.utils.email_normalize import email_hash as compute_email_hash

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class ForgetRequest(BaseModel):
    email: EmailStr
    # Mirror SignalTombstone.reason column (max 120 chars).
    reason: Optional[str] = Field(default=None, max_length=120)


class ForgetResponse(BaseModel):
    purged_count: int
    tombstone_id: str
    email_hash: str


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/contacts/forget", response_model=ForgetResponse)
async def forget_contact(
    body: ForgetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete every signal for the given email within the user's org.

    Any signed-in user (no admin role required) may purge data within their
    own org — this is the GDPR self-service path. To purge data across orgs
    a support operator uses POST /admin/purge instead.
    """
    target_hash = compute_email_hash(body.email)
    if not target_hash or len(target_hash) != 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email — could not be normalized.",
        )

    org_id = str(current_user.organization_id)
    now = datetime.utcnow()

    tombstone = SignalTombstone(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        tombstone_type="email_hash",
        email_hash=target_hash,
        reason=(body.reason or "user-initiated forget")[:120],
        issued_at=now,
        issued_by_user_id=str(current_user.user_id),
    )
    db.add(tombstone)

    purged_count = 0

    # 1. Direct match by contact_match_key (signals not yet bound to a contact).
    direct_stmt = (
        update(Signal)
        .where(
            Signal.organization_id == org_id,
            Signal.contact_match_key == target_hash,
            Signal.deleted_at.is_(None),
        )
        .values(deleted_at=now)
        .execution_options(synchronize_session=False)
    )
    direct_result = await db.execute(direct_stmt)
    purged_count += direct_result.rowcount or 0

    # 2. Match via alias → contact_id (signals already bound to a contact).
    alias_stmt = select(EmailAlias.contact_id).where(
        EmailAlias.organization_id == org_id,
        EmailAlias.email_hash == target_hash,
    )
    alias_result = await db.execute(alias_stmt)
    contact_ids = [row[0] for row in alias_result.fetchall()]
    if contact_ids:
        contact_stmt = (
            update(Signal)
            .where(
                Signal.organization_id == org_id,
                Signal.contact_id.in_(contact_ids),
                Signal.deleted_at.is_(None),
            )
            .values(deleted_at=now)
            .execution_options(synchronize_session=False)
        )
        contact_result = await db.execute(contact_stmt)
        purged_count += contact_result.rowcount or 0

    await db.flush()
    return ForgetResponse(
        purged_count=purged_count,
        tombstone_id=tombstone.id,
        email_hash=target_hash,
    )
