"""
LeadSpot Branding Service

GoHighLevel-style branding with inheritance:
- Client branding inherits from Parent Agency
- Agency branding inherits from Platform Default
- Each level can customize individual properties
"""

import logging
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization, DEFAULT_BRANDING

logger = logging.getLogger(__name__)


class BrandingConfig(BaseModel):
    """Branding configuration model"""
    app_name: str = "LeadSpot.ai"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#818cf8"
    secondary_color: str = "#a5b4fc"
    accent_color: str = "#c7d2fe"
    custom_css: Optional[str] = None


class BrandingService:
    """
    Branding service with GoHighLevel-style inheritance.

    Inheritance chain: Client -> Parent Agency -> Platform Default

    Key features:
    - Automatic inheritance from parent organization
    - Property-level override (only set properties override parent)
    - Platform defaults as final fallback
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_organization(self, org_id: str) -> Optional[Organization]:
        """Get organization by ID."""
        result = await self.db.execute(
            select(Organization).where(Organization.organization_id == org_id)
        )
        return result.scalar_one_or_none()

    async def get_effective_branding(self, org_id: str) -> BrandingConfig:
        """
        Get effective branding with inheritance from parent agency.

        Inheritance Logic (GoHighLevel-style):
        1. If org has logo_url set, treat branding as fully customized
        2. Otherwise, merge with parent agency branding
        3. Fall back to platform defaults for any unset properties
        """
        org = await self.get_organization(org_id)
        if not org:
            logger.warning(f"Organization not found: {org_id}")
            return BrandingConfig()

        org_branding = org.branding or {}

        # Check if org has complete branding (logo set = fully customized)
        if org_branding.get("logo_url"):
            return BrandingConfig(**self._merge_with_defaults(org_branding))

        # Inherit from parent agency
        if org.parent_organization_id:
            parent = await self.get_organization(org.parent_organization_id)
            if parent and parent.branding:
                parent_branding = parent.branding

                # Check if parent has logo (indicates customization)
                if parent_branding.get("logo_url"):
                    # Merge: org properties override parent properties
                    merged = {**parent_branding, **self._filter_set_values(org_branding)}
                    return BrandingConfig(**self._merge_with_defaults(merged))

        # Fall back to platform defaults
        return BrandingConfig(**self._merge_with_defaults(org_branding))

    def _filter_set_values(self, branding: dict) -> dict:
        """Filter out None/null values from branding dict."""
        return {k: v for k, v in branding.items() if v is not None}

    def _merge_with_defaults(self, branding: dict) -> dict:
        """Merge branding with platform defaults for any missing properties."""
        result = dict(DEFAULT_BRANDING)
        for key, value in branding.items():
            if value is not None:
                result[key] = value
        return result

    async def can_customize_branding(self, org_id: str) -> bool:
        """Check if organization has white-label feature enabled."""
        org = await self.get_organization(org_id)
        if not org:
            return False

        features = org.features or {}
        return features.get("white_label_enabled", False)

    async def update_branding(
        self,
        org_id: str,
        branding_update: dict,
        check_permission: bool = True
    ) -> BrandingConfig:
        """
        Update organization branding.

        Args:
            org_id: Organization ID
            branding_update: Dict of branding properties to update
            check_permission: Whether to check white_label_enabled feature

        Returns:
            Updated effective branding config

        Raises:
            PermissionError: If white-label not enabled and check_permission=True
            ValueError: If organization not found
        """
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        # Check feature access
        if check_permission and not await self.can_customize_branding(org_id):
            raise PermissionError(
                "White-label branding not enabled. Upgrade to Pro or Agency plan."
            )

        # Merge update with existing branding
        current_branding = org.branding or {}
        updated_branding = {**current_branding}

        # Apply updates (only set non-None values)
        for key, value in branding_update.items():
            if key in BrandingConfig.model_fields:
                updated_branding[key] = value

        # Save to database
        org.branding = updated_branding
        await self.db.commit()
        await self.db.refresh(org)

        logger.info(f"Updated branding for org {org_id}")

        # Return effective branding (with inheritance applied)
        return await self.get_effective_branding(org_id)

    async def reset_branding(self, org_id: str) -> BrandingConfig:
        """
        Reset branding to inherit from parent/defaults.

        Clears all custom branding properties so organization
        inherits branding from parent agency or platform defaults.
        """
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        # Reset to empty dict (will inherit from parent)
        org.branding = {}
        await self.db.commit()
        await self.db.refresh(org)

        logger.info(f"Reset branding for org {org_id}")
        return await self.get_effective_branding(org_id)

    async def get_branding_css(self, org_id: str) -> str:
        """
        Generate CSS variables for organization branding.

        Returns CSS that can be injected into the frontend to apply branding.
        """
        branding = await self.get_effective_branding(org_id)

        css = f"""
:root {{
    --ls-app-name: "{branding.app_name}";
    --ls-primary-color: {branding.primary_color};
    --ls-secondary-color: {branding.secondary_color};
    --ls-accent-color: {branding.accent_color};
    --ls-primary-gradient: linear-gradient(135deg, {branding.primary_color} 0%, {branding.secondary_color} 50%, {branding.accent_color} 100%);
}}
"""

        # Add custom CSS if provided
        if branding.custom_css:
            css += f"\n/* Custom CSS */\n{branding.custom_css}"

        return css

    async def get_branding_for_domain(self, custom_domain: str) -> Optional[BrandingConfig]:
        """
        Look up branding by custom domain.

        Used for white-label domain routing.
        """
        result = await self.db.execute(
            select(Organization).where(Organization.custom_domain == custom_domain)
        )
        org = result.scalar_one_or_none()

        if not org:
            return None

        return await self.get_effective_branding(org.organization_id)
