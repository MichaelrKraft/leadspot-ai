"""
Contacts API Routes

Wraps Mautic contacts CRUD. Falls back to demo data if Mautic is not configured.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import get_current_user
from app.models import User
from app.services.mautic_client import MauticClient, MauticAuthError

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Response Models
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
    lastActive: Optional[str] = None


class ContactsListResponse(BaseModel):
    contacts: list[ContactResponse]
    total: int
    page: int
    limit: int


class ContactCreate(BaseModel):
    firstName: str
    lastName: str
    email: str
    company: Optional[str] = None
    phone: Optional[str] = None
    tags: Optional[list[str]] = None


class ContactUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    tags: Optional[list[str]] = None


# =============================================================================
# Demo data (used when Mautic is not configured)
# =============================================================================

DEMO_CONTACTS: list[ContactResponse] = [
    ContactResponse(
        id="demo-1",
        firstName="John",
        lastName="Smith",
        email="john.smith@acme.com",
        company="Acme Corp",
        phone="+1 555-0123",
        tags=["hot-lead", "enterprise"],
        points=85,
        lastActive="2 hours ago",
    ),
    ContactResponse(
        id="demo-2",
        firstName="Sarah",
        lastName="Johnson",
        email="sarah.j@techstart.io",
        company="TechStart",
        tags=["demo-requested"],
        points=120,
        lastActive="Yesterday",
    ),
    ContactResponse(
        id="demo-3",
        firstName="Michael",
        lastName="Chen",
        email="mchen@globalinc.com",
        company="Global Inc",
        phone="+1 555-0456",
        tags=["newsletter", "webinar-attended"],
        points=45,
        lastActive="3 days ago",
    ),
]


# =============================================================================
# Helpers
# =============================================================================

def _normalize_contact(raw: dict) -> ContactResponse:
    """Normalize a Mautic contact dict into our ContactResponse shape."""
    fields = raw.get("fields", {}).get("all", {})
    contact_id = str(raw.get("id", ""))

    firstname = fields.get("firstname") or ""
    lastname = fields.get("lastname") or ""
    email = fields.get("email") or ""
    company = fields.get("company") or ""
    phone = fields.get("phone") or fields.get("mobile") or ""
    points = int(raw.get("points", 0) or 0)

    # Extract tag names from Mautic tags list
    raw_tags = raw.get("tags", [])
    tags: list[str] = []
    for t in raw_tags:
        if isinstance(t, dict):
            tags.append(t.get("tag", ""))
        elif isinstance(t, str):
            tags.append(t)

    last_active = raw.get("lastActive") or raw.get("dateModified") or None

    return ContactResponse(
        id=contact_id,
        firstName=firstname,
        lastName=lastname,
        email=email,
        company=company,
        phone=phone,
        tags=[t for t in tags if t],
        points=points,
        lastActive=last_active,
    )


async def _get_mautic_client(
    current_user: User,
    session: AsyncSession,
) -> Optional[MauticClient]:
    """Get MauticClient for the current user's organization."""
    if not current_user.organization_id:
        return None
    try:
        return await MauticClient.from_organization(
            str(current_user.organization_id), session
        )
    except (MauticAuthError, Exception):
        return None


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/contacts", response_model=ContactsListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contacts from Mautic. Falls back to demo data if Mautic is not configured."""
    mautic = await _get_mautic_client(current_user, session)

    if not mautic:
        contacts = DEMO_CONTACTS
        if search:
            q = search.lower()
            contacts = [
                c for c in contacts
                if q in c.firstName.lower()
                or q in c.lastName.lower()
                or q in c.email.lower()
                or q in c.company.lower()
            ]
        return ContactsListResponse(
            contacts=contacts,
            total=len(contacts),
            page=page,
            limit=limit,
        )

    try:
        data = await mautic.get_contacts(
            limit=limit,
            start=(page - 1) * limit,
            search=search,
            order_by="lastActive",
            order_direction="DESC",
        )
        # Mautic returns contacts as a dict keyed by id
        raw_contacts = data.get("contacts", {})
        if isinstance(raw_contacts, dict):
            contact_list = list(raw_contacts.values())
        else:
            contact_list = raw_contacts

        total = int(data.get("total", len(contact_list)))

        return ContactsListResponse(
            contacts=[_normalize_contact(c) for c in contact_list],
            total=total,
            page=page,
            limit=limit,
        )
    except Exception as e:
        logger.exception(f"Error fetching contacts from Mautic: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch contacts")


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single contact by ID from Mautic."""
    mautic = await _get_mautic_client(current_user, session)

    if not mautic:
        match = next((c for c in DEMO_CONTACTS if c.id == contact_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="Contact not found")
        return match

    try:
        data = await mautic.get_contact(int(contact_id))
        raw = data.get("contact", data)
        return _normalize_contact(raw)
    except Exception as e:
        logger.exception(f"Error fetching contact {contact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch contact")


@router.post("/contacts", response_model=ContactResponse, status_code=201)
async def create_contact(
    body: ContactCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new contact in Mautic."""
    mautic = await _get_mautic_client(current_user, session)

    if not mautic:
        return ContactResponse(
            id="demo-new",
            firstName=body.firstName,
            lastName=body.lastName,
            email=body.email,
            company=body.company or "",
            phone=body.phone or "",
            tags=body.tags or [],
            points=0,
            lastActive="Just now",
        )

    try:
        payload: dict = {
            "firstname": body.firstName,
            "lastname": body.lastName,
            "email": body.email,
        }
        if body.company:
            payload["company"] = body.company
        if body.phone:
            payload["phone"] = body.phone
        if body.tags:
            payload["tags"] = body.tags

        data = await mautic.create_contact(payload)
        raw = data.get("contact", data)
        return _normalize_contact(raw)
    except Exception as e:
        logger.exception(f"Error creating contact: {e}")
        raise HTTPException(status_code=500, detail="Failed to create contact")


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update contact fields in Mautic."""
    mautic = await _get_mautic_client(current_user, session)

    if not mautic:
        raise HTTPException(status_code=503, detail="Mautic not configured")

    try:
        payload: dict = {}
        if body.firstName is not None:
            payload["firstname"] = body.firstName
        if body.lastName is not None:
            payload["lastname"] = body.lastName
        if body.email is not None:
            payload["email"] = body.email
        if body.company is not None:
            payload["company"] = body.company
        if body.phone is not None:
            payload["phone"] = body.phone
        if body.tags is not None:
            payload["tags"] = body.tags

        data = await mautic.update_contact(int(contact_id), payload)
        raw = data.get("contact", data)
        return _normalize_contact(raw)
    except Exception as e:
        logger.exception(f"Error updating contact {contact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update contact")


@router.delete("/contacts/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a contact from Mautic."""
    mautic = await _get_mautic_client(current_user, session)

    if not mautic:
        raise HTTPException(status_code=503, detail="Mautic not configured")

    try:
        # MauticClient has no delete_contact method; use _request directly
        await mautic._request("DELETE", f"/api/contacts/{contact_id}/delete")
    except Exception as e:
        logger.exception(f"Error deleting contact {contact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete contact")
