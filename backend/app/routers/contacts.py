"""
Contacts API Routes

CRUD backed by local SQLite contacts table.
"""

import csv
import io
import logging
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contact import Contact
from app.models.email_alias import EmailAlias
from app.models.user import User
from app.services.auth_service import get_current_user
from app.utils.email_normalize import email_hash, normalize_email

logger = logging.getLogger(__name__)

# CSV import limits
CSV_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
CSV_MAX_ROWS = 50_000  # Hard cap so a malicious file can't OOM us.

# Minimal RFC-5322-ish email validator. Strict enough to reject "j .ane@x.com"
# but tolerant enough not to fight Latin-extended chars.
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class ContactResponse(BaseModel):
    id: str
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    company: str = ""
    phone: str = ""
    tags: list[str] = []
    points: int = 0
    lastActive: str | None = None


class ContactsListResponse(BaseModel):
    contacts: list[ContactResponse]
    total: int
    page: int
    limit: int


class ContactCreate(BaseModel):
    firstName: str
    lastName: str
    email: str
    company: str | None = None
    phone: str | None = None
    tags: list[str] | None = None


class ContactUpdate(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    email: str | None = None
    company: str | None = None
    phone: str | None = None
    tags: list[str] | None = None
    points: int | None = None


# =============================================================================
# Helpers
# =============================================================================

def _to_response(c: Contact) -> ContactResponse:
    last_active = None
    if c.last_active:
        last_active = c.last_active.isoformat()
    return ContactResponse(
        id=c.id,
        firstName=c.first_name,
        lastName=c.last_name,
        email=c.email,
        company=c.company or "",
        phone=c.phone or "",
        tags=c.tags,
        points=c.points,
        lastActive=last_active,
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/contacts", response_model=ContactsListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contacts for the current organization."""
    query = select(Contact).where(
        Contact.organization_id == str(current_user.organization_id)
    )

    if search:
        q = f"%{search.lower()}%"
        from sqlalchemy import func, or_
        query = query.where(
            or_(
                func.lower(Contact.first_name).like(q),
                func.lower(Contact.last_name).like(q),
                func.lower(Contact.email).like(q),
                func.lower(Contact.company).like(q),
            )
        )

    count_result = await db.execute(query)
    total = len(count_result.scalars().all())

    result = await db.execute(
        query.order_by(Contact.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    contacts = result.scalars().all()

    return ContactsListResponse(
        contacts=[_to_response(c) for c in contacts],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single contact by ID."""
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == str(current_user.organization_id),
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return _to_response(contact)


@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new contact."""
    contact = Contact(
        id=str(uuid.uuid4()),
        first_name=body.firstName,
        last_name=body.lastName,
        email=body.email,
        company=body.company,
        phone=body.phone,
        organization_id=str(current_user.organization_id),
        last_active=datetime.utcnow(),
    )
    contact.tags = body.tags or []
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return _to_response(contact)


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update contact fields."""
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == str(current_user.organization_id),
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    if body.firstName is not None:
        contact.first_name = body.firstName
    if body.lastName is not None:
        contact.last_name = body.lastName
    if body.email is not None:
        contact.email = body.email
    if body.company is not None:
        contact.company = body.company
    if body.phone is not None:
        contact.phone = body.phone
    if body.tags is not None:
        contact.tags = body.tags
    if body.points is not None:
        contact.points = body.points

    contact.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(contact)
    return _to_response(contact)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a contact."""
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == str(current_user.organization_id),
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    await db.delete(contact)
    await db.commit()


# ── Demo Data Endpoints ────────────────────────────────────────────────────────

@router.get("/onboarding/demo-status")
async def get_demo_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return whether the org has demo data seeded."""
    from app.models.organization import Organization
    result = await db.execute(
        select(Organization).where(
            Organization.organization_id == str(current_user.organization_id)
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        return {"is_demo": False, "demo_seeded_at": None}
    return {
        "is_demo": org.demo_seeded_at is not None,
        "demo_seeded_at": org.demo_seeded_at.isoformat() if org.demo_seeded_at else None,
    }


@router.delete("/onboarding/demo-data", status_code=status.HTTP_200_OK)
async def clear_demo_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all is_demo=True rows for this org across contacts, deals, and campaigns."""
    from sqlalchemy import delete as sql_delete

    from app.models.campaign import Campaign
    from app.models.deal import Deal
    from app.models.organization import Organization

    org_id = str(current_user.organization_id)
    user_id = str(current_user.user_id)

    contacts_result = await db.execute(
        sql_delete(Contact)
        .where(Contact.organization_id == org_id, Contact.is_demo == True)
        .returning(Contact.id)
    )
    contacts_deleted = len(contacts_result.fetchall())

    deals_result = await db.execute(
        sql_delete(Deal)
        .where(Deal.org_id == org_id, Deal.is_demo == True)
        .returning(Deal.id)
    )
    deals_deleted = len(deals_result.fetchall())

    campaigns_result = await db.execute(
        sql_delete(Campaign)
        .where(Campaign.user_id == user_id, Campaign.is_demo == True)
        .returning(Campaign.id)
    )
    campaigns_deleted = len(campaigns_result.fetchall())

    # Clear demo_seeded_at so org can be re-seeded if needed
    await db.execute(
        Organization.__table__.update()
        .where(Organization.organization_id == org_id)
        .values(demo_seeded_at=None)
    )

    await db.commit()
    return {
        "deleted": {
            "contacts": contacts_deleted,
            "deals": deals_deleted,
            "campaigns": campaigns_deleted,
        }
    }


# ── CSV Import ─────────────────────────────────────────────────────────────────

# Column-name aliases: case + underscore + space-insensitive. The key is the
# canonical field; values are accepted CSV-header forms (lowercased, trimmed).
# Headers are normalized via _norm_header() before lookup.
CSV_HEADER_ALIASES: dict[str, set[str]] = {
    "email": {"email", "emailaddress", "email_address", "e-mail"},
    "first_name": {"firstname", "first_name", "given_name", "givenname"},
    "last_name": {"lastname", "last_name", "surname", "familyname", "family_name"},
    "company": {"company", "organization", "org", "account", "employer"},
    "phone": {"phone", "phonenumber", "phone_number", "mobile", "tel"},
    "tags": {"tags", "tag", "labels"},
}


def _norm_header(h: str) -> str:
    """Normalize a CSV header for alias lookup.
    Lowercase, strip, then strip BOM + collapse spaces/underscores away.
    """
    if not h:
        return ""
    s = h.lstrip("﻿").strip().lower()
    return re.sub(r"[\s_-]+", "", s).replace("_", "")


def _build_header_map(fieldnames: list[str]) -> dict[str, str]:
    """Map canonical-field-name -> original CSV header. Missing fields absent."""
    out: dict[str, str] = {}
    for original in fieldnames or []:
        norm = _norm_header(original)
        for canonical, aliases in CSV_HEADER_ALIASES.items():
            if canonical in out:
                continue
            # Aliases stored normalized too (already are above) — compare.
            if any(_norm_header(a) == norm for a in aliases):
                out[canonical] = original
                break
    return out


@router.post("/contacts/import-csv")
async def import_contacts_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-import contacts from a CSV file.

    - Multipart upload, max 5MB.
    - `email` column is REQUIRED. Optional: first_name, last_name, company, phone, tags.
    - Headers are case-insensitive and underscore/space-flexible.
    - Skips empty/invalid emails.
    - Skips duplicates (same normalized email already in this org).
    - Creates a primary EmailAlias row per imported contact.

    Returns: {imported, skipped_duplicate, skipped_invalid, errors[]}.
    """
    raw = await file.read()
    if len(raw) > CSV_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV exceeds {CSV_MAX_BYTES // (1024 * 1024)}MB limit.",
        )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file.",
        )

    # Decode tolerantly. UTF-8 with BOM is the common path; latin-1 catches
    # weird Excel exports without crashing.
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []
    header_map = _build_header_map(fieldnames)

    if "email" not in header_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must include an 'email' column.",
        )

    org_id = str(current_user.organization_id)

    # Pre-load existing email_hashes for the org to fast-check duplicates.
    existing_stmt = select(EmailAlias.email_hash).where(EmailAlias.organization_id == org_id)
    existing_result = await db.execute(existing_stmt)
    existing_hashes: set[str] = {h for (h,) in existing_result.all() if h}

    # Also pre-load contact emails (some legacy contacts may not have alias rows).
    legacy_stmt = select(Contact.email).where(Contact.organization_id == org_id)
    legacy_result = await db.execute(legacy_stmt)
    for (e,) in legacy_result.all():
        if e:
            h = email_hash(e)
            if h:
                existing_hashes.add(h)

    imported = 0
    skipped_duplicate = 0
    skipped_invalid = 0
    errors: list[str] = []

    # Track hashes added in this import to dedupe within the same file.
    in_batch_hashes: set[str] = set()

    now = datetime.utcnow()

    row_count = 0
    for row in reader:
        row_count += 1
        if row_count > CSV_MAX_ROWS:
            errors.append(f"Row {row_count}: max {CSV_MAX_ROWS} rows exceeded; stopping.")
            break

        raw_email = (row.get(header_map["email"]) or "").strip()
        if not raw_email or not _EMAIL_RE.match(raw_email):
            skipped_invalid += 1
            continue

        normalized = normalize_email(raw_email)
        if not normalized:
            skipped_invalid += 1
            continue
        h = email_hash(raw_email)
        if not h:
            skipped_invalid += 1
            continue

        if h in existing_hashes or h in in_batch_hashes:
            skipped_duplicate += 1
            continue

        first = (row.get(header_map.get("first_name", "")) or "").strip() if "first_name" in header_map else ""
        last = (row.get(header_map.get("last_name", "")) or "").strip() if "last_name" in header_map else ""
        company = (row.get(header_map.get("company", "")) or "").strip() or None if "company" in header_map else None
        phone = (row.get(header_map.get("phone", "")) or "").strip() or None if "phone" in header_map else None

        tags_list: list[str] = []
        if "tags" in header_map:
            raw_tags = (row.get(header_map["tags"]) or "").strip()
            if raw_tags:
                tags_list = [t.strip() for t in raw_tags.split(",") if t.strip()]

        contact_id = str(uuid.uuid4())
        contact = Contact(
            id=contact_id,
            first_name=first,
            last_name=last,
            email=raw_email,  # Display form preserved.
            company=company,
            phone=phone,
            organization_id=org_id,
            last_active=None,
            created_at=now,
            updated_at=now,
        )
        contact.tags = tags_list
        db.add(contact)

        alias = EmailAlias(
            id=str(uuid.uuid4()),
            contact_id=contact_id,
            organization_id=org_id,
            email_hash=h,
            email_display=raw_email[:255],
            is_primary=True,
            created_at=now,
        )
        db.add(alias)

        in_batch_hashes.add(h)
        imported += 1

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.exception("CSV import failed for org=%s", org_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed during commit: {exc}",
        ) from exc

    return {
        "imported": imported,
        "skipped_duplicate": skipped_duplicate,
        "skipped_invalid": skipped_invalid,
        "errors": errors,
    }
