"""Contacts sync router — daemon mirror replication.

Mounted at prefix `/api`.

GET /contacts/sync?since=<iso>&limit=500

Returns contacts updated since cursor (ascending by updated_at). Org-scoped
to the authenticated daemon. The `email` field is hashed server-side via
app.utils.email_normalize.email_hash so the daemon never receives raw email.

See plan §2.3 ("Local matching uses a contact_mirror table on the daemon
synced via GET /contacts/sync").
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, DaemonCredential, EmailAlias
from app.services.daemon_auth_service import get_current_daemon
from app.utils.email_normalize import email_hash

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class ContactSyncAlias(BaseModel):
    email_hash: str
    is_primary: bool


class ContactSyncRow(BaseModel):
    contact_id: str
    email_hash: str
    aliases: list[ContactSyncAlias]
    linkedin_slug: Optional[str] = None
    name_norm: str
    company_norm: str
    updated_at: str
    deleted: bool = False


class ContactSyncResponse(BaseModel):
    contacts: list[ContactSyncRow]
    next_since: Optional[str] = None


# =============================================================================
# Helpers
# =============================================================================

def _name_norm(first: str, last: str) -> str:
    """'first last' lowercased + collapsed whitespace. Matches daemon-side mirror."""
    parts = [p.strip().lower() for p in (first or "", last or "") if p and p.strip()]
    return " ".join(parts)


def _company_norm(company: Optional[str]) -> str:
    if not company:
        return ""
    return company.strip().lower()


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/contacts/sync", response_model=ContactSyncResponse)
async def sync_contacts(
    since: Optional[datetime] = Query(None, description="ISO timestamp; returns rows with updated_at >= since"),
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    daemon: DaemonCredential = Depends(get_current_daemon),
):
    """Delta sync of contacts for the daemon's mirror table.

    Sort order: updated_at ASC so the cursor (next_since) is monotonic.

    NOTE on deletes: the Contact model in v1 doesn't carry a soft-delete flag.
    Cascade deletion is handled via `signal_tombstones` (tombstone_type='contact').
    A future migration may add Contact.deleted_at; until then we always emit
    `deleted=False`. The contract supports `deleted=True` so the daemon code
    is forward-compatible.
    """
    org_id = daemon.organization_id

    stmt = (
        select(Contact)
        .where(Contact.organization_id == org_id)
        .order_by(Contact.updated_at.asc())
        .limit(limit)
    )
    if since is not None:
        stmt = stmt.where(Contact.updated_at >= since)

    result = await db.execute(stmt)
    contacts = result.scalars().all()

    if not contacts:
        return ContactSyncResponse(contacts=[], next_since=None)

    contact_ids = [c.id for c in contacts]
    alias_stmt = select(EmailAlias).where(
        EmailAlias.organization_id == org_id,
        EmailAlias.contact_id.in_(contact_ids),
    )
    alias_result = await db.execute(alias_stmt)
    aliases_by_contact: dict[str, list[EmailAlias]] = {}
    for a in alias_result.scalars().all():
        aliases_by_contact.setdefault(a.contact_id, []).append(a)

    rows: list[ContactSyncRow] = []
    for c in contacts:
        primary_hash = email_hash(c.email)
        explicit_aliases = aliases_by_contact.get(c.id, [])
        # Always include the contact's primary email as an alias entry — even
        # if there's no row in email_aliases (older contacts predate the
        # alias table). The daemon dedupes by hash.
        alias_entries: list[ContactSyncAlias] = []
        seen_hashes: set[str] = set()
        if primary_hash:
            alias_entries.append(ContactSyncAlias(email_hash=primary_hash, is_primary=True))
            seen_hashes.add(primary_hash)
        for a in explicit_aliases:
            if a.email_hash in seen_hashes:
                continue
            alias_entries.append(ContactSyncAlias(email_hash=a.email_hash, is_primary=a.is_primary))
            seen_hashes.add(a.email_hash)

        rows.append(
            ContactSyncRow(
                contact_id=c.id,
                email_hash=primary_hash,
                aliases=alias_entries,
                linkedin_slug=None,  # Not yet on Contact model.
                name_norm=_name_norm(c.first_name, c.last_name),
                company_norm=_company_norm(c.company),
                updated_at=c.updated_at.isoformat() if c.updated_at else "",
                deleted=False,
            )
        )

    next_since = contacts[-1].updated_at.isoformat() if len(contacts) == limit else None

    return ContactSyncResponse(contacts=rows, next_since=next_since)
