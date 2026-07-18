"""
Emails router — CRUD for email persistence
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_internal_key
from app.models.email import Email
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class EmailCreate(BaseModel):
    subject: str
    from_addr: str
    to_addr: str
    body: str | None = None
    status: str = "Draft"
    email_type: str = "Outbound"
    opened: bool = False
    replied: bool = False
    sent_at: datetime | None = None


class EmailUpdate(BaseModel):
    subject: str | None = None
    from_addr: str | None = None
    to_addr: str | None = None
    body: str | None = None
    status: str | None = None
    email_type: str | None = None
    opened: bool | None = None
    replied: bool | None = None
    sent_at: datetime | None = None


class EmailResponse(BaseModel):
    id: str
    subject: str
    status: str
    from_addr: str
    to_addr: str
    body: str | None
    email_type: str
    opened: bool
    replied: bool
    sent_at: datetime | None
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmailsListResponse(BaseModel):
    emails: list[EmailResponse]
    total: int
    page: int
    limit: int


VALID_STATUSES = {"Sent", "Draft", "Scheduled", "Failed"}
VALID_TYPES = {"Outbound", "Inbound"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/emails", response_model=EmailsListResponse, tags=["emails"])
async def list_emails(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all emails for the authenticated user."""
    query = select(Email).where(Email.user_id == str(current_user.user_id))
    if status:
        query = query.where(Email.status == status)

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    emails = result.scalars().all()

    count_result = await db.execute(
        select(Email).where(Email.user_id == str(current_user.user_id))
    )
    total = len(count_result.scalars().all())

    return EmailsListResponse(
        emails=[EmailResponse.model_validate(e) for e in emails],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/emails", response_model=EmailResponse, status_code=status.HTTP_201_CREATED, tags=["emails"])
async def create_email(
    data: EmailCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new email (draft or sent)."""
    if data.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )
    if data.email_type not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid email_type. Must be one of: {', '.join(VALID_TYPES)}",
        )

    email = Email(
        subject=data.subject,
        status=data.status,
        from_addr=data.from_addr,
        to_addr=data.to_addr,
        body=data.body,
        email_type=data.email_type,
        opened=data.opened,
        replied=data.replied,
        sent_at=data.sent_at,
        user_id=str(current_user.user_id),
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)
    return EmailResponse.model_validate(email)


@router.get("/emails/{email_id}", response_model=EmailResponse, tags=["emails"])
async def get_email(
    email_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single email by ID."""
    result = await db.execute(
        select(Email).where(
            Email.id == email_id,
            Email.user_id == str(current_user.user_id),
        )
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    return EmailResponse.model_validate(email)


@router.patch("/emails/{email_id}", response_model=EmailResponse, tags=["emails"])
async def update_email(
    email_id: str,
    data: EmailUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update email fields."""
    result = await db.execute(
        select(Email).where(
            Email.id == email_id,
            Email.user_id == str(current_user.user_id),
        )
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )
    if "email_type" in update_data and update_data["email_type"] not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid email_type. Must be one of: {', '.join(VALID_TYPES)}",
        )

    for field, value in update_data.items():
        setattr(email, field, value)

    email.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(email)
    return EmailResponse.model_validate(email)


class RecordSendRequest(BaseModel):
    contact_id: str
    campaign_id: str | None = None
    subject: str
    to_addr: str
    from_addr: str
    body: str | None = None
    message_id: str | None = None  # Resend message ID
    user_id: str = "agent-service"


@router.post(
    "/emails/record-send",
    status_code=status.HTTP_201_CREATED,
    tags=["emails"],
    dependencies=[Depends(require_internal_key)],
)
async def record_email_send(data: RecordSendRequest, db: AsyncSession = Depends(get_db)):
    """Called by agent-service after sending an email via Resend to record it in the database."""
    import uuid

    email_record = Email(
        id=str(uuid.uuid4()),
        subject=data.subject,
        status="Sent",
        from_addr=data.from_addr,
        to_addr=data.to_addr,
        body=data.body,
        email_type="Outbound",
        campaign_id=data.campaign_id,
        contact_id=data.contact_id,
        message_id=data.message_id,
        user_id=data.user_id,
        sent_at=datetime.utcnow(),
    )
    db.add(email_record)
    await db.commit()
    return {"status": "recorded", "email_id": email_record.id}


@router.delete("/emails/{email_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["emails"])
async def delete_email(
    email_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an email."""
    result = await db.execute(
        select(Email).where(
            Email.id == email_id,
            Email.user_id == str(current_user.user_id),
        )
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    await db.delete(email)
    await db.commit()
