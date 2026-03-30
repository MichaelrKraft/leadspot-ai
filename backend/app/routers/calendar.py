"""
Calendar routes for event management and public booking.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.calendar_event import CalendarEvent
from app.services.auth_service import get_current_user
from app.models.user import User

router = APIRouter()

EST = ZoneInfo("America/New_York")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class EventCreate(BaseModel):
    title: str
    start: datetime
    end: datetime
    type: str = "call"
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    agent_id: Optional[str] = None
    notes: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    type: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    agent_id: Optional[str] = None
    notes: Optional[str] = None


class EventResponse(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    type: str
    contact_id: Optional[str]
    contact_name: Optional[str]
    agent_id: Optional[str]
    notes: Optional[str]
    org_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookingRequest(BaseModel):
    agent_id: str
    contact_name: str
    contact_email: str
    contact_phone: Optional[str] = None
    start: datetime
    end: datetime
    notes: Optional[str] = None


class BookingResponse(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    message: str


class AvailabilitySlot(BaseModel):
    start: datetime
    end: datetime


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------

@router.get("/api/calendar/events")
async def list_events(
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List calendar events for the current org, optionally filtered by date range."""
    query = select(CalendarEvent).where(
        CalendarEvent.org_id == current_user.organization_id
    )

    if start:
        start_dt = datetime.fromisoformat(start)
        query = query.where(CalendarEvent.start >= start_dt)
    if end:
        end_dt = datetime.fromisoformat(end)
        query = query.where(CalendarEvent.start <= end_dt)

    query = query.order_by(CalendarEvent.start)
    result = await db.execute(query)
    events = result.scalars().all()

    return {"events": [EventResponse.model_validate(e) for e in events]}


@router.post("/api/calendar/events", status_code=status.HTTP_201_CREATED)
async def create_event(
    data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """Create a new calendar event."""
    event = CalendarEvent(
        title=data.title,
        start=data.start,
        end=data.end,
        type=data.type,
        contact_id=data.contact_id,
        contact_name=data.contact_name,
        agent_id=data.agent_id,
        notes=data.notes,
        org_id=current_user.organization_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return EventResponse.model_validate(event)


@router.patch("/api/calendar/events/{event_id}")
async def update_event(
    event_id: str,
    data: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """Update an existing calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.id == event_id,
                CalendarEvent.org_id == current_user.organization_id,
            )
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)
    return EventResponse.model_validate(event)


@router.delete("/api/calendar/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.id == event_id,
                CalendarEvent.org_id == current_user.organization_id,
            )
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await db.delete(event)
    await db.commit()


# ---------------------------------------------------------------------------
# Public endpoints (no auth)
# ---------------------------------------------------------------------------

@router.get("/api/calendar/availability/{agent_id}", include_in_schema=True)
async def get_availability(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return available 30-minute slots for an agent.
    Slots are Mon-Fri 9am-5pm EST, excluding already-booked events.
    """
    now = datetime.now(tz=EST)
    # Return slots for the next 14 days
    slots: List[AvailabilitySlot] = []

    # Fetch booked events for this agent in the window
    window_end = now + timedelta(days=14)
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.agent_id == agent_id,
                CalendarEvent.start >= now,
                CalendarEvent.start <= window_end,
            )
        )
    )
    booked = result.scalars().all()
    booked_ranges = [(e.start, e.end) for e in booked]

    current = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if current < now:
        current = now

    while current < window_end:
        # Skip weekends (0=Mon … 6=Sun)
        if current.weekday() < 5:
            slot_end = current + timedelta(minutes=30)
            # Only offer future slots within business hours
            if current >= now and current.hour >= 9 and slot_end.hour <= 17:
                # Check no overlap with booked events
                overlaps = any(
                    not (slot_end <= b_start or current >= b_end)
                    for b_start, b_end in booked_ranges
                )
                if not overlaps:
                    slots.append(AvailabilitySlot(start=current, end=slot_end))

        # Advance by 30 minutes, reset to 9am on next business day when past 17:00
        current = current + timedelta(minutes=30)
        if current.hour >= 17:
            # Jump to 9am next day
            current = (current + timedelta(days=1)).replace(
                hour=9, minute=0, second=0, microsecond=0
            )

    return {"agent_id": agent_id, "slots": [s.model_dump() for s in slots]}


@router.post("/api/calendar/book", include_in_schema=True, status_code=status.HTTP_201_CREATED)
async def book_appointment(
    data: BookingRequest,
    db: AsyncSession = Depends(get_db),
) -> BookingResponse:
    """
    Public booking endpoint. Creates a 'call' event for the given agent.
    No authentication required.
    """
    title = f"Call - {data.contact_name}"
    event = CalendarEvent(
        title=title,
        start=data.start,
        end=data.end,
        type="call",
        contact_name=data.contact_name,
        agent_id=data.agent_id,
        notes=data.notes,
        org_id=data.agent_id,  # Use agent_id as org scope for public bookings
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return BookingResponse(
        id=event.id,
        title=event.title,
        start=event.start,
        end=event.end,
        message="Your call is booked! You'll receive a confirmation email.",
    )
