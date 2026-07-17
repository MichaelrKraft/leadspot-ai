"""
Org-level endpoints for the authenticated user's own organization.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.branding_service import BrandingConfig, BrandingService

router = APIRouter()


@router.get("/org/branding", response_model=BrandingConfig, tags=["org"])
async def get_my_org_branding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandingConfig:
    """Effective branding for the current user's organization (inheritance applied)."""
    branding_service = BrandingService(db)
    return await branding_service.get_effective_branding(str(current_user.organization_id))
