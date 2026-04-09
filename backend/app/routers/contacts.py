"""
Contacts API Routes

CRUD backed by local SQLite contacts table.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contact import Contact
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

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
    points: Optional[int] = None


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
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contacts for the current organization."""
    query = select(Contact).where(
        Contact.organization_id == str(current_user.organization_id)
    )

    if search:
        q = f"%{search.lower()}%"
        from sqlalchemy import or_, func
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
