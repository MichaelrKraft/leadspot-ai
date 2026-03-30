"""
Deals / Pipeline router
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.deal import Deal
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class DealCreate(BaseModel):
    title: str
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    value: float = 0.0
    stage: str = "lead"
    priority: str = "medium"
    notes: Optional[str] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    value: Optional[float] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None


class DealResponse(BaseModel):
    id: str
    title: str
    contact_id: Optional[str]
    contact_name: Optional[str]
    value: float
    stage: str
    priority: str
    notes: Optional[str]
    org_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StageDefinition(BaseModel):
    id: str
    name: str
    color: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

STAGE_DEFINITIONS: List[StageDefinition] = [
    StageDefinition(id="lead", name="Lead", color="blue"),
    StageDefinition(id="qualified", name="Qualified", color="indigo"),
    StageDefinition(id="proposal", name="Proposal", color="purple"),
    StageDefinition(id="negotiation", name="Negotiation", color="amber"),
    StageDefinition(id="won", name="Won", color="green"),
    StageDefinition(id="lost", name="Lost", color="red"),
]

VALID_STAGES = {s.id for s in STAGE_DEFINITIONS}
VALID_PRIORITIES = {"low", "medium", "high"}


@router.get("/deals", tags=["deals"])
async def list_deals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all deals for the authenticated user's organisation."""
    result = await db.execute(
        select(Deal).where(Deal.org_id == str(current_user.organization_id))
    )
    deals = result.scalars().all()
    return {"deals": [DealResponse.model_validate(d) for d in deals]}


@router.get("/deals/stages", tags=["deals"])
async def list_stages(
    current_user: User = Depends(get_current_user),
) -> List[StageDefinition]:
    """Return stage definitions with colours."""
    return STAGE_DEFINITIONS


@router.post("/deals", status_code=status.HTTP_201_CREATED, tags=["deals"])
async def create_deal(
    data: DealCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DealResponse:
    """Create a new deal."""
    if data.stage not in VALID_STAGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}",
        )
    if data.priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid priority. Must be one of: {', '.join(VALID_PRIORITIES)}",
        )

    deal = Deal(
        title=data.title,
        contact_id=data.contact_id,
        contact_name=data.contact_name,
        value=data.value,
        stage=data.stage,
        priority=data.priority,
        notes=data.notes,
        org_id=str(current_user.organization_id),
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return DealResponse.model_validate(deal)


@router.patch("/deals/{deal_id}", tags=["deals"])
async def update_deal(
    deal_id: str,
    data: DealUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DealResponse:
    """Update deal fields (including stage for drag-drop)."""
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.org_id == str(current_user.organization_id),
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    update_data = data.model_dump(exclude_unset=True)

    if "stage" in update_data and update_data["stage"] not in VALID_STAGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}",
        )
    if "priority" in update_data and update_data["priority"] not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid priority. Must be one of: {', '.join(VALID_PRIORITIES)}",
        )

    for field, value in update_data.items():
        setattr(deal, field, value)

    deal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deal)
    return DealResponse.model_validate(deal)


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["deals"])
async def delete_deal(
    deal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a deal."""
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.org_id == str(current_user.organization_id),
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    await db.delete(deal)
    await db.commit()
