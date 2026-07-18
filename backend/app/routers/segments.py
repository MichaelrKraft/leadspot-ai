"""
Segments router — CRUD for segment persistence
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.segment import Segment
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SegmentCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#6366f1"
    contact_count: int = 0
    filter_type: str = "manual"
    filter_criteria: str | None = None


class SegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    contact_count: int | None = None
    filter_type: str | None = None
    filter_criteria: str | None = None


class SegmentResponse(BaseModel):
    id: str
    name: str
    description: str | None
    color: str
    contact_count: int
    filter_type: str
    filter_criteria: str | None
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SegmentsListResponse(BaseModel):
    segments: list[SegmentResponse]
    total: int


VALID_FILTER_TYPES = {"manual", "dynamic"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/segments", response_model=SegmentsListResponse, tags=["segments"])
async def list_segments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all segments for the authenticated user."""
    result = await db.execute(
        select(Segment).where(Segment.user_id == str(current_user.user_id))
    )
    segments = result.scalars().all()
    return SegmentsListResponse(
        segments=[SegmentResponse.model_validate(s) for s in segments],
        total=len(segments),
    )


@router.post("/segments", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED, tags=["segments"])
async def create_segment(
    data: SegmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new segment."""
    if data.filter_type not in VALID_FILTER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid filter_type. Must be one of: {', '.join(VALID_FILTER_TYPES)}",
        )

    segment = Segment(
        name=data.name,
        description=data.description,
        color=data.color,
        contact_count=data.contact_count,
        filter_type=data.filter_type,
        filter_criteria=data.filter_criteria,
        user_id=str(current_user.user_id),
    )
    db.add(segment)
    await db.commit()
    await db.refresh(segment)
    return SegmentResponse.model_validate(segment)


@router.get("/segments/{segment_id}", response_model=SegmentResponse, tags=["segments"])
async def get_segment(
    segment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single segment by ID."""
    result = await db.execute(
        select(Segment).where(
            Segment.id == segment_id,
            Segment.user_id == str(current_user.user_id),
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")
    return SegmentResponse.model_validate(segment)


@router.patch("/segments/{segment_id}", response_model=SegmentResponse, tags=["segments"])
async def update_segment(
    segment_id: str,
    data: SegmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update segment fields."""
    result = await db.execute(
        select(Segment).where(
            Segment.id == segment_id,
            Segment.user_id == str(current_user.user_id),
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    update_data = data.model_dump(exclude_unset=True)

    if "filter_type" in update_data and update_data["filter_type"] not in VALID_FILTER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid filter_type. Must be one of: {', '.join(VALID_FILTER_TYPES)}",
        )

    for field, value in update_data.items():
        setattr(segment, field, value)

    segment.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(segment)
    return SegmentResponse.model_validate(segment)


@router.delete("/segments/{segment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["segments"])
async def delete_segment(
    segment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a segment."""
    result = await db.execute(
        select(Segment).where(
            Segment.id == segment_id,
            Segment.user_id == str(current_user.user_id),
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    await db.delete(segment)
    await db.commit()
