"""Admin purge router — GDPR right-to-be-forgotten.

Mounted at prefix `/admin`.

POST /admin/purge — User JWT + admin/superadmin role. Inserts a SignalTombstone
of type `email_hash` and soft-deletes any signals whose contact_match_key
matches the email_hash, scoped to the requesting user's org.

See plan §11.2 ("Right-to-be-forgotten flow").
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EmailAlias, Signal, SignalTombstone, User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


_ADMIN_ROLES = {"admin", "superadmin"}


# =============================================================================
# Schemas
# =============================================================================

class AdminPurgeRequest(BaseModel):
    email_hash: str = Field(..., min_length=64, max_length=64)
    reason: str = Field(default="", max_length=120)


class AdminPurgeResponse(BaseModel):
    purged_count: int
    tombstone_id: str


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/purge", response_model=AdminPurgeResponse)
async def admin_purge(
    body: AdminPurgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cascade-soft-delete all signals matching email_hash, scoped to user's org.

    Also drops EmailAlias rows for the hash so the contact stops resolving.
    Tombstone type is `email_hash` — the daemon will purge its mirror,
    unmatched_log, and signal_archive on next sync.
    """
    if (current_user.role or "") not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin or superadmin role required",
        )

    org_id = str(current_user.organization_id)
    now = datetime.utcnow()

    tombstone = SignalTombstone(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        tombstone_type="email_hash",
        email_hash=body.email_hash,
        reason=body.reason or None,
        issued_at=now,
        issued_by_user_id=str(current_user.user_id),
    )
    db.add(tombstone)

    # Soft-delete any signals whose contact_match_key is this email_hash AND
    # any signals attached to contacts whose alias matches.
    matching_alias_stmt = select(EmailAlias.contact_id).where(
        EmailAlias.organization_id == org_id,
        EmailAlias.email_hash == body.email_hash,
    )
    alias_result = await db.execute(matching_alias_stmt)
    contact_ids_for_alias = [row[0] for row in alias_result.fetchall()]

    purged_count = 0

    # 1. Direct match by contact_match_key.
    direct_stmt = (
        update(Signal)
        .where(
            Signal.organization_id == org_id,
            Signal.contact_match_key == body.email_hash,
            Signal.deleted_at.is_(None),
        )
        .values(deleted_at=now)
        .execution_options(synchronize_session=False)
    )
    direct_result = await db.execute(direct_stmt)
    purged_count += direct_result.rowcount or 0

    # 2. Match via alias -> contact_id.
    if contact_ids_for_alias:
        contact_stmt = (
            update(Signal)
            .where(
                Signal.organization_id == org_id,
                Signal.contact_id.in_(contact_ids_for_alias),
                Signal.deleted_at.is_(None),
            )
            .values(deleted_at=now)
            .execution_options(synchronize_session=False)
        )
        contact_result = await db.execute(contact_stmt)
        purged_count += contact_result.rowcount or 0

    await db.flush()
    return AdminPurgeResponse(purged_count=purged_count, tombstone_id=tombstone.id)
