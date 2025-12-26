"""
Agency Management API Routes

GoHighLevel-style agency management:
- Sub-account creation and management
- Wallet and rebilling configuration
- Branding management
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.organization import Organization, DEFAULT_BRANDING, DEFAULT_FEATURES
from app.services.branding_service import BrandingConfig, BrandingService
from app.services.wallet_service import WalletService, WalletSummary, RebillingService

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateSubAccountRequest(BaseModel):
    """Request to create a new sub-account"""
    name: str = Field(..., min_length=1, max_length=255)
    domain: str = Field(..., min_length=3, max_length=255)
    subscription_tier: str = Field(default="pilot")
    features_override: Optional[dict] = None


class SubAccountResponse(BaseModel):
    """Sub-account details"""
    organization_id: str
    name: str
    domain: str
    organization_type: str
    subscription_tier: str
    subscription_status: str
    wallet_balance: float
    created_at: str
    features: dict
    mautic_connected: bool


class SubAccountSummary(BaseModel):
    """Sub-account summary for listing"""
    organization_id: str
    name: str
    domain: str
    subscription_tier: str
    subscription_status: str
    wallet_balance: float
    mautic_connected: bool


class UsageReport(BaseModel):
    """Usage report for a sub-account"""
    organization_id: str
    name: str
    period: str
    ai_operations: int
    contacts_used: int
    contacts_limit: int
    total_cost: float


class FeatureUpdate(BaseModel):
    """Feature flags update request"""
    white_label_enabled: Optional[bool] = None
    voice_agents_enabled: Optional[bool] = None
    ai_insights_enabled: Optional[bool] = None
    lead_scoring_enabled: Optional[bool] = None
    max_contacts: Optional[int] = None
    max_users: Optional[int] = None


class RebillingConfig(BaseModel):
    """Rebilling configuration"""
    agency_id: str
    markup: float
    max_markup: float
    rebilling_enabled: bool


class WalletRechargeRequest(BaseModel):
    """Wallet recharge request"""
    amount: Decimal = Field(..., ge=10)


class AutoRechargeConfig(BaseModel):
    """Auto-recharge configuration"""
    enabled: bool
    recharge_amount: Optional[Decimal] = None
    recharge_threshold: Optional[Decimal] = None


class BrandingUpdateRequest(BaseModel):
    """Branding update request"""
    app_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    custom_css: Optional[str] = None


# =============================================================================
# Helper Functions
# =============================================================================

async def get_organization(org_id: str, session: AsyncSession) -> Optional[Organization]:
    """Get organization by ID."""
    result = await session.execute(
        select(Organization).where(Organization.organization_id == org_id)
    )
    return result.scalar_one_or_none()


async def require_agency(org_id: str, session: AsyncSession) -> Organization:
    """Get and verify organization is an agency."""
    org = await get_organization(org_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.organization_type != "agency":
        raise HTTPException(status_code=403, detail="Only agencies can perform this action")
    return org


async def require_agency_or_platform(org_id: str, session: AsyncSession) -> Organization:
    """Get and verify organization is agency or platform."""
    org = await get_organization(org_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.organization_type not in ("agency", "platform"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return org


# =============================================================================
# Sub-Account Management Endpoints
# =============================================================================

@router.get("/agency/sub-accounts", response_model=list[SubAccountSummary])
async def list_sub_accounts(
    organization_id: str = Query(..., description="Agency organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    List all sub-accounts for this agency.

    Returns summary of all client organizations under this agency.
    """
    agency = await require_agency_or_platform(organization_id, session)

    result = await session.execute(
        select(Organization).where(
            Organization.parent_organization_id == agency.organization_id
        )
    )
    sub_accounts = result.scalars().all()

    return [
        SubAccountSummary(
            organization_id=sub.organization_id,
            name=sub.name,
            domain=sub.domain,
            subscription_tier=sub.subscription_tier,
            subscription_status=sub.subscription_status,
            wallet_balance=float(sub.wallet_balance),
            mautic_connected=bool(sub.mautic_access_token),
        )
        for sub in sub_accounts
    ]


@router.post("/agency/sub-accounts", response_model=SubAccountResponse)
async def create_sub_account(
    data: CreateSubAccountRequest,
    organization_id: str = Query(..., description="Agency organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Create a new sub-account (client) under this agency.

    The new sub-account will inherit agency branding unless customized.
    """
    agency = await require_agency(organization_id, session)

    # Check if agency can create more sub-accounts
    features = agency.features or {}
    max_subs = features.get("max_sub_organizations", 0)

    if max_subs != -1:  # -1 = unlimited
        current_count = len(list(agency.children)) if hasattr(agency, 'children') else 0
        if current_count >= max_subs:
            raise HTTPException(
                status_code=403,
                detail=f"Maximum sub-accounts reached ({max_subs}). Upgrade your plan."
            )

    # Check domain uniqueness
    existing = await session.execute(
        select(Organization).where(Organization.domain == data.domain)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Domain already exists")

    # Prepare features (start with defaults, apply overrides)
    sub_features = dict(DEFAULT_FEATURES)
    if data.features_override:
        for key, value in data.features_override.items():
            if key in sub_features:
                sub_features[key] = value

    # Create sub-account
    sub_account = Organization(
        organization_id=str(uuid4()),
        name=data.name,
        domain=data.domain,
        subscription_tier=data.subscription_tier,
        organization_type="client",
        parent_organization_id=agency.organization_id,
        branding={},  # Empty = inherit from parent
        features=sub_features,
        subscription_status="active",
        wallet_balance=Decimal("0.00"),
    )

    session.add(sub_account)
    await session.commit()
    await session.refresh(sub_account)

    logger.info(f"Created sub-account {sub_account.organization_id} for agency {agency.organization_id}")

    return SubAccountResponse(
        organization_id=sub_account.organization_id,
        name=sub_account.name,
        domain=sub_account.domain,
        organization_type=sub_account.organization_type,
        subscription_tier=sub_account.subscription_tier,
        subscription_status=sub_account.subscription_status,
        wallet_balance=float(sub_account.wallet_balance),
        created_at=sub_account.created_at.isoformat(),
        features=sub_account.features,
        mautic_connected=False,
    )


@router.get("/agency/sub-accounts/{sub_id}", response_model=SubAccountResponse)
async def get_sub_account(
    sub_id: str,
    organization_id: str = Query(..., description="Agency organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """Get details of a specific sub-account."""
    agency = await require_agency_or_platform(organization_id, session)

    sub = await get_organization(sub_id, session)
    if not sub or sub.parent_organization_id != agency.organization_id:
        raise HTTPException(status_code=404, detail="Sub-account not found")

    return SubAccountResponse(
        organization_id=sub.organization_id,
        name=sub.name,
        domain=sub.domain,
        organization_type=sub.organization_type,
        subscription_tier=sub.subscription_tier,
        subscription_status=sub.subscription_status,
        wallet_balance=float(sub.wallet_balance),
        created_at=sub.created_at.isoformat(),
        features=sub.features,
        mautic_connected=bool(sub.mautic_access_token),
    )


@router.put("/agency/sub-accounts/{sub_id}/features", response_model=SubAccountResponse)
async def update_sub_account_features(
    sub_id: str,
    features: FeatureUpdate,
    organization_id: str = Query(..., description="Agency organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Update feature toggles for a sub-account.

    Allows agencies to enable/disable features for their clients.
    """
    agency = await require_agency(organization_id, session)

    sub = await get_organization(sub_id, session)
    if not sub or sub.parent_organization_id != agency.organization_id:
        raise HTTPException(status_code=404, detail="Sub-account not found")

    # Update features
    current_features = sub.features or {}
    update_dict = features.model_dump(exclude_none=True)

    for key, value in update_dict.items():
        current_features[key] = value

    sub.features = current_features
    await session.commit()
    await session.refresh(sub)

    logger.info(f"Updated features for sub-account {sub_id}")

    return SubAccountResponse(
        organization_id=sub.organization_id,
        name=sub.name,
        domain=sub.domain,
        organization_type=sub.organization_type,
        subscription_tier=sub.subscription_tier,
        subscription_status=sub.subscription_status,
        wallet_balance=float(sub.wallet_balance),
        created_at=sub.created_at.isoformat(),
        features=sub.features,
        mautic_connected=bool(sub.mautic_access_token),
    )


# =============================================================================
# Wallet Endpoints
# =============================================================================

@router.get("/agency/wallet", response_model=WalletSummary)
async def get_agency_wallet(
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """Get agency wallet balance and settings."""
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    wallet_service = WalletService(session)
    return await wallet_service.get_wallet_summary(organization_id)


@router.post("/agency/wallet/recharge", response_model=WalletSummary)
async def recharge_wallet(
    data: WalletRechargeRequest,
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Manually recharge agency wallet.

    In production, this would process a Stripe payment.
    For now, it directly adds credits (for testing).
    """
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    wallet_service = WalletService(session)

    # Add credits (in production, this would go through Stripe first)
    await wallet_service.add_credits(
        organization_id,
        data.amount,
        "Manual wallet recharge",
        "recharge"
    )

    return await wallet_service.get_wallet_summary(organization_id)


@router.put("/agency/wallet/auto-recharge", response_model=WalletSummary)
async def configure_auto_recharge(
    config: AutoRechargeConfig,
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """Configure auto-recharge settings for the wallet."""
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    wallet_service = WalletService(session)
    return await wallet_service.configure_auto_recharge(
        organization_id,
        enabled=config.enabled,
        recharge_amount=config.recharge_amount,
        recharge_threshold=config.recharge_threshold,
    )


# =============================================================================
# Rebilling Endpoints
# =============================================================================

@router.get("/agency/rebilling", response_model=RebillingConfig)
async def get_rebilling_config(
    organization_id: str = Query(..., description="Agency organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """Get current rebilling configuration for the agency."""
    agency = await require_agency(organization_id, session)

    features = agency.features or {}
    return RebillingConfig(
        agency_id=agency.organization_id,
        markup=features.get("rebilling_markup", 1.0),
        max_markup=features.get("rebilling_max_markup", 10),
        rebilling_enabled=features.get("rebilling_enabled", False),
    )


@router.put("/agency/rebilling", response_model=RebillingConfig)
async def configure_rebilling(
    markup: float = Query(..., ge=1.0, le=10.0, description="Markup multiplier (1.0-10.0)"),
    organization_id: str = Query(..., description="Agency organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Set the rebilling markup for sub-accounts.

    Agencies can charge clients 1x to 10x their base cost.
    The agency keeps the difference as profit.
    """
    agency = await require_agency(organization_id, session)

    wallet_service = WalletService(session)
    rebilling_service = RebillingService(session, wallet_service)

    result = await rebilling_service.configure_markup(organization_id, markup)
    return RebillingConfig(**result)


# =============================================================================
# Branding Endpoints
# =============================================================================

@router.get("/agency/branding", response_model=BrandingConfig)
async def get_branding(
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """Get effective branding (with inheritance applied)."""
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    branding_service = BrandingService(session)
    return await branding_service.get_effective_branding(organization_id)


@router.put("/agency/branding", response_model=BrandingConfig)
async def update_branding(
    data: BrandingUpdateRequest,
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Update organization branding.

    Requires white_label_enabled feature (Pro or Agency plan).
    """
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    branding_service = BrandingService(session)

    try:
        update_dict = data.model_dump(exclude_none=True)
        return await branding_service.update_branding(organization_id, update_dict)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/agency/branding/reset", response_model=BrandingConfig)
async def reset_branding(
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Reset branding to inherit from parent/defaults.

    Clears all custom branding so organization inherits from parent agency
    or falls back to LeadSpot.ai defaults.
    """
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    branding_service = BrandingService(session)
    return await branding_service.reset_branding(organization_id)


@router.get("/agency/branding/css")
async def get_branding_css(
    organization_id: str = Query(..., description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Get CSS variables for organization branding.

    Returns CSS that can be injected into the frontend to apply branding.
    """
    org = await get_organization(organization_id, session)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    branding_service = BrandingService(session)
    css = await branding_service.get_branding_css(organization_id)

    from fastapi.responses import Response
    return Response(content=css, media_type="text/css")
