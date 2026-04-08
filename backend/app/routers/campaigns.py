"""
Campaigns router — CRUD for campaign persistence
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign import Campaign
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CampaignCreate(BaseModel):
    name: str
    status: str = "Draft"
    type: str = "Email"
    leads: int = 0
    opened: int = 0
    replied: int = 0


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    leads: Optional[int] = None
    opened: Optional[int] = None
    replied: Optional[int] = None


class CampaignResponse(BaseModel):
    id: str
    name: str
    status: str
    type: str
    leads: int
    opened: int
    replied: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CampaignsListResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int
    page: int
    limit: int


VALID_STATUSES = {"Active", "Paused", "Draft", "Completed"}
VALID_TYPES = {"Email", "SMS", "Voice", "Multi-step"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/campaigns", response_model=CampaignsListResponse, tags=["campaigns"])
async def list_campaigns(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all campaigns for the authenticated user."""
    result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == str(current_user.id))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    campaigns = result.scalars().all()

    count_result = await db.execute(
        select(Campaign).where(Campaign.user_id == str(current_user.id))
    )
    total = len(count_result.scalars().all())

    return CampaignsListResponse(
        campaigns=[CampaignResponse.model_validate(c) for c in campaigns],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED, tags=["campaigns"])
async def create_campaign(
    data: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new campaign."""
    if data.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )
    if data.type not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid type. Must be one of: {', '.join(VALID_TYPES)}",
        )

    campaign = Campaign(
        name=data.name,
        status=data.status,
        type=data.type,
        leads=data.leads,
        opened=data.opened,
        replied=data.replied,
        user_id=str(current_user.id),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse, tags=["campaigns"])
async def get_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single campaign by ID."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.user_id == str(current_user.id),
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse, tags=["campaigns"])
async def update_campaign(
    campaign_id: str,
    data: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update campaign fields."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.user_id == str(current_user.id),
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )
    if "type" in update_data and update_data["type"] not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid type. Must be one of: {', '.join(VALID_TYPES)}",
        )

    for field, value in update_data.items():
        setattr(campaign, field, value)

    campaign.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["campaigns"])
async def delete_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a campaign."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.user_id == str(current_user.id),
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    await db.delete(campaign)
    await db.commit()
