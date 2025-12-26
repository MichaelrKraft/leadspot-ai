"""
Settings API Router

Handles organization settings including API keys and CRM connection settings.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth_service import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Store OAuth states temporarily (in production, use Redis)
_oauth_states: dict[str, dict] = {}


# ============================================================================
# Schemas
# ============================================================================

class ApiKeyStatus(BaseModel):
    """Response model for API key status"""
    anthropic_key_set: bool


class UpdateAnthropicKey(BaseModel):
    """Request model for updating Anthropic API key"""
    anthropic_api_key: str


class MauticConnectionStatus(BaseModel):
    """Response model for Mautic connection status"""
    connected: bool
    mautic_url: Optional[str] = None
    last_sync_at: Optional[str] = None


class UpdateMauticConnection(BaseModel):
    """Request model for updating Mautic connection"""
    mautic_url: str
    mautic_client_id: str
    mautic_client_secret: str


# ============================================================================
# API Key Endpoints
# ============================================================================

@router.get("/api-keys", response_model=ApiKeyStatus)
async def get_api_key_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get status of API keys (whether they are set, not the actual values)"""
    from sqlalchemy import select
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return ApiKeyStatus(
        anthropic_key_set=bool(org.anthropic_api_key)
    )


@router.post("/api-keys")
async def update_anthropic_api_key(
    data: UpdateAnthropicKey,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update the Anthropic API key for the organization"""
    from sqlalchemy import select
    from app.models.organization import Organization

    # Validate key format
    if not data.anthropic_api_key.startswith("sk-ant-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid API key format. Anthropic keys start with 'sk-ant-'"
        )

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Update the API key
    org.anthropic_api_key = data.anthropic_api_key
    await session.commit()

    logger.info(f"Updated Anthropic API key for organization {org.organization_id}")

    return {"message": "API key updated successfully"}


@router.delete("/api-keys")
async def remove_anthropic_api_key(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Remove the Anthropic API key for the organization"""
    from sqlalchemy import select
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Remove the API key
    org.anthropic_api_key = None
    await session.commit()

    logger.info(f"Removed Anthropic API key for organization {org.organization_id}")

    return {"message": "API key removed successfully"}


# ============================================================================
# Mautic Connection Endpoints
# ============================================================================

@router.get("/mautic", response_model=MauticConnectionStatus)
async def get_mautic_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get Mautic connection status"""
    from sqlalchemy import select
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return MauticConnectionStatus(
        connected=bool(org.mautic_access_token),
        mautic_url=org.mautic_url,
    )


@router.post("/mautic")
async def update_mautic_connection(
    data: UpdateMauticConnection,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update Mautic connection settings (URL, client ID, secret)"""
    from sqlalchemy import select
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Update Mautic settings
    org.mautic_url = data.mautic_url.rstrip("/")
    org.mautic_client_id = data.mautic_client_id
    org.mautic_client_secret = data.mautic_client_secret

    await session.commit()

    logger.info(f"Updated Mautic settings for organization {org.organization_id}")

    return {"message": "Mautic settings updated successfully"}


@router.delete("/mautic")
async def disconnect_mautic(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Disconnect Mautic integration"""
    from sqlalchemy import select
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Clear all Mautic-related fields
    org.mautic_url = None
    org.mautic_client_id = None
    org.mautic_client_secret = None
    org.mautic_access_token = None
    org.mautic_refresh_token = None
    org.mautic_token_expires_at = None

    await session.commit()

    logger.info(f"Disconnected Mautic for organization {org.organization_id}")

    return {"message": "Mautic disconnected successfully"}


# ============================================================================
# Mautic OAuth Flow Endpoints
# ============================================================================

class MauticOAuthStart(BaseModel):
    """Request to start Mautic OAuth flow"""
    mautic_url: str
    client_id: str
    client_secret: str


@router.post("/mautic/authorize")
async def start_mautic_oauth(
    data: MauticOAuthStart,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Start Mautic OAuth flow.

    Saves the Mautic credentials and returns the authorization URL
    to redirect the user to.
    """
    from sqlalchemy import select
    from app.models.organization import Organization

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Store Mautic credentials
    mautic_url = data.mautic_url.rstrip("/")
    org.mautic_url = mautic_url
    org.mautic_client_id = data.client_id
    org.mautic_client_secret = data.client_secret
    await session.commit()

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state with organization info (expires in 10 minutes)
    _oauth_states[state] = {
        "organization_id": current_user.organization_id,
        "mautic_url": mautic_url,
        "client_id": data.client_id,
        "client_secret": data.client_secret,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }

    # Build callback URL
    callback_url = f"{settings.API_BASE_URL}/api/settings/mautic/callback"

    # Build authorization URL
    auth_params = {
        "client_id": data.client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "state": state,
    }

    authorization_url = f"{mautic_url}/oauth/v2/authorize?{urlencode(auth_params)}"

    logger.info(f"Starting Mautic OAuth for organization {org.organization_id}")

    return {
        "authorization_url": authorization_url,
        "state": state,
    }


@router.get("/mautic/callback")
async def mautic_oauth_callback(
    code: str = Query(..., description="Authorization code from Mautic"),
    state: str = Query(..., description="CSRF state parameter"),
    session: AsyncSession = Depends(get_db),
):
    """
    Handle Mautic OAuth callback.

    Exchanges the authorization code for access and refresh tokens.
    """
    from sqlalchemy import select
    from app.models.organization import Organization

    # Validate state
    if state not in _oauth_states:
        logger.error(f"Invalid OAuth state: {state}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/integrations?error=invalid_state"
        )

    state_data = _oauth_states[state]

    # Check if state expired
    if datetime.utcnow() > state_data["expires_at"]:
        del _oauth_states[state]
        logger.error(f"OAuth state expired: {state}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/integrations?error=expired_state"
        )

    # Clean up used state
    del _oauth_states[state]

    organization_id = state_data["organization_id"]
    mautic_url = state_data["mautic_url"]
    client_id = state_data["client_id"]
    client_secret = state_data["client_secret"]

    # Exchange code for tokens
    callback_url = f"{settings.API_BASE_URL}/api/settings/mautic/callback"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{mautic_url}/oauth/v2/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": callback_url,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30.0,
            )

            if response.status_code != 200:
                logger.error(f"Mautic token exchange failed: {response.text}")
                return RedirectResponse(
                    url=f"{settings.FRONTEND_URL}/settings/integrations?error=token_exchange_failed"
                )

            tokens = response.json()

    except httpx.RequestError as e:
        logger.error(f"Mautic token exchange request failed: {e}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/integrations?error=connection_failed"
        )

    # Save tokens to organization
    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == organization_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        logger.error(f"Organization not found: {organization_id}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/integrations?error=org_not_found"
        )

    # Calculate token expiration
    expires_in = tokens.get("expires_in", 3600)
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    # Update organization with tokens
    org.mautic_access_token = tokens["access_token"]
    org.mautic_refresh_token = tokens.get("refresh_token")
    org.mautic_token_expires_at = expires_at

    await session.commit()

    logger.info(f"Mautic OAuth completed for organization {organization_id}")

    # Redirect back to Mautic plugin with success
    return RedirectResponse(
        url=f"{mautic_url}/s/leadspot?connected=true"
    )


# ============================================================================
# Plugin OAuth Flow (No Auth Required - For Mautic Plugin)
# ============================================================================

class PluginMauticSetup(BaseModel):
    """Request to set up Mautic API from plugin"""
    mautic_url: str
    client_id: str
    client_secret: str


@router.post("/plugin/mautic/setup")
async def plugin_mautic_setup(
    data: PluginMauticSetup,
    session: AsyncSession = Depends(get_db),
):
    """
    Set up Mautic OAuth from the plugin (no authentication required).

    This endpoint is used by the Mautic plugin to initiate OAuth.
    It finds or creates an organization by mautic_url.
    """
    from sqlalchemy import select
    from app.models.organization import Organization

    mautic_url = data.mautic_url.rstrip("/")

    # Find or create organization by mautic_url
    result = await session.execute(
        select(Organization).where(Organization.mautic_url == mautic_url)
    )
    org = result.scalar_one_or_none()

    if not org:
        # Create new organization
        import uuid
        org = Organization(
            organization_id=str(uuid.uuid4()),
            name=f"Mautic - {mautic_url.split('//')[1]}",
            domain=mautic_url.split('//')[1],
            subscription_tier="pilot",
            mautic_url=mautic_url,
        )
        session.add(org)

    # Update credentials
    org.mautic_client_id = data.client_id
    org.mautic_client_secret = data.client_secret
    await session.commit()

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state with organization info
    _oauth_states[state] = {
        "organization_id": org.organization_id,
        "mautic_url": mautic_url,
        "client_id": data.client_id,
        "client_secret": data.client_secret,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }

    # Build callback URL
    callback_url = f"{settings.API_BASE_URL}/api/settings/mautic/callback"

    # Build authorization URL
    auth_params = {
        "client_id": data.client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "state": state,
    }

    authorization_url = f"{mautic_url}/oauth/v2/authorize?{urlencode(auth_params)}"

    logger.info(f"Plugin OAuth setup for {mautic_url}")

    return {
        "authorization_url": authorization_url,
        "state": state,
        "organization_id": org.organization_id,
    }


@router.get("/plugin/mautic/status")
async def plugin_mautic_status(
    mautic_url: str = Query(..., description="Mautic instance URL"),
    session: AsyncSession = Depends(get_db),
):
    """
    Check Mautic connection status for a given URL.

    Used by the plugin to check if OAuth is set up.
    """
    from sqlalchemy import select
    from app.models.organization import Organization

    mautic_url = mautic_url.rstrip("/")

    result = await session.execute(
        select(Organization).where(Organization.mautic_url == mautic_url)
    )
    org = result.scalar_one_or_none()

    if not org:
        return {
            "connected": False,
            "organization_id": None,
            "has_credentials": False,
        }

    return {
        "connected": bool(org.mautic_access_token),
        "organization_id": org.organization_id,
        "has_credentials": bool(org.mautic_client_id and org.mautic_client_secret),
    }
