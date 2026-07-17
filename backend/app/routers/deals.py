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
    pipeline: str = "sales"
    stage: Optional[str] = None  # defaults to the pipeline's first stage
    priority: str = "medium"
    property_name: Optional[str] = None
    notes: Optional[str] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    value: Optional[float] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    property_name: Optional[str] = None
    notes: Optional[str] = None


class DealResponse(BaseModel):
    id: str
    title: str
    contact_id: Optional[str]
    contact_name: Optional[str]
    value: float
    pipeline: str
    stage: str
    priority: str
    property_name: Optional[str]
    stage_changed_at: Optional[datetime]
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

PIPELINE_STAGES: dict[str, List[StageDefinition]] = {
    "sales": [
        StageDefinition(id="lead", name="Lead", color="blue"),
        StageDefinition(id="qualified", name="Qualified", color="indigo"),
        StageDefinition(id="proposal", name="Proposal", color="purple"),
        StageDefinition(id="negotiation", name="Negotiation", color="amber"),
        StageDefinition(id="won", name="Won", color="green"),
        StageDefinition(id="lost", name="Lost", color="red"),
    ],
    "leasing": [
        StageDefinition(id="inquiry", name="Inquiry", color="blue"),
        StageDefinition(id="loi_negotiation", name="LOI Negotiation", color="indigo"),
        StageDefinition(id="construction_pricing", name="Construction Pricing", color="purple"),
        StageDefinition(id="lease_drafting", name="Lease Drafting", color="cyan"),
        StageDefinition(id="lease_negotiation", name="Lease Negotiation", color="amber"),
        StageDefinition(id="signed", name="Signed", color="green"),
        StageDefinition(id="lost", name="Lost", color="red"),
    ],
}

VALID_PIPELINES = set(PIPELINE_STAGES)
VALID_PRIORITIES = {"low", "medium", "high"}


def _valid_stages(pipeline: str) -> set:
    return {s.id for s in PIPELINE_STAGES[pipeline]}


@router.get("/deals", tags=["deals"])
async def list_deals(
    pipeline: str = "sales",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List deals for the authenticated user's organisation, filtered by pipeline."""
    if pipeline not in VALID_PIPELINES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid pipeline. Must be one of: {', '.join(sorted(VALID_PIPELINES))}",
        )
    result = await db.execute(
        select(Deal).where(
            Deal.org_id == str(current_user.organization_id),
            Deal.pipeline == pipeline,
        )
    )
    deals = result.scalars().all()
    return {"deals": [DealResponse.model_validate(d) for d in deals]}


@router.get("/deals/stages", tags=["deals"])
async def list_stages(
    pipeline: str = "sales",
    current_user: User = Depends(get_current_user),
) -> List[StageDefinition]:
    """Return stage definitions with colours for the given pipeline."""
    if pipeline not in VALID_PIPELINES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid pipeline. Must be one of: {', '.join(sorted(VALID_PIPELINES))}",
        )
    return PIPELINE_STAGES[pipeline]


@router.post("/deals", status_code=status.HTTP_201_CREATED, tags=["deals"])
async def create_deal(
    data: DealCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DealResponse:
    """Create a new deal."""
    if data.pipeline not in VALID_PIPELINES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid pipeline. Must be one of: {', '.join(sorted(VALID_PIPELINES))}",
        )
    stage = data.stage or PIPELINE_STAGES[data.pipeline][0].id
    if stage not in _valid_stages(data.pipeline):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid stage for {data.pipeline} pipeline. Must be one of: {', '.join(sorted(_valid_stages(data.pipeline)))}",
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
        pipeline=data.pipeline,
        stage=stage,
        priority=data.priority,
        property_name=data.property_name,
        stage_changed_at=datetime.utcnow(),
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

    if "stage" in update_data and update_data["stage"] not in _valid_stages(deal.pipeline):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid stage for {deal.pipeline} pipeline. Must be one of: {', '.join(sorted(_valid_stages(deal.pipeline)))}",
        )
    if "priority" in update_data and update_data["priority"] not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid priority. Must be one of: {', '.join(VALID_PRIORITIES)}",
        )

    if "stage" in update_data and update_data["stage"] != deal.stage:
        deal.stage_changed_at = datetime.utcnow()

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
