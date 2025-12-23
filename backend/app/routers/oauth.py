"""OAuth API endpoints for managing integrations"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.schemas.oauth import (
    DisconnectResponse,
    OAuthAuthorizeResponse,
    OAuthConnectionList,
)
from app.services.auth_service import get_current_user
from app.services.encryption import get_encryption_service
from app.services.oauth import (
    GmailOAuthProvider,
    GoogleOAuthProvider,
    MicrosoftOAuthProvider,
    SalesforceOAuthProvider,
    SlackOAuthProvider,
)

router = APIRouter(prefix="/oauth", tags=["oauth"])

# OAuth provider instances
oauth_providers = {
    "google": lambda: GoogleOAuthProvider(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{settings.API_BASE_URL}/oauth/google/callback",
    ),
    "gmail": lambda: GmailOAuthProvider(
        client_id=settings.GOOGLE_CLIENT_ID,  # Reuses Google OAuth credentials
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{settings.API_BASE_URL}/oauth/gmail/callback",
    ),
    "microsoft": lambda: MicrosoftOAuthProvider(
        client_id=settings.MICROSOFT_CLIENT_ID,
        client_secret=settings.MICROSOFT_CLIENT_SECRET,
        redirect_uri=f"{settings.API_BASE_URL}/oauth/microsoft/callback",
    ),
    "slack": lambda: SlackOAuthProvider(
        client_id=settings.SLACK_CLIENT_ID,
        client_secret=settings.SLACK_CLIENT_SECRET,
        redirect_uri=f"{settings.API_BASE_URL}/oauth/slack/callback",
    ),
    "salesforce": lambda: SalesforceOAuthProvider(
        client_id=settings.SALESFORCE_CLIENT_ID,
        client_secret=settings.SALESFORCE_CLIENT_SECRET,
        redirect_uri=f"{settings.API_BASE_URL}/oauth/salesforce/callback",
        instance_url=settings.SALESFORCE_INSTANCE_URL,
    ),
}


def get_oauth_provider(provider: str):
    """Get OAuth provider instance by name"""
    if provider not in oauth_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider: {provider}. Supported: {', '.join(oauth_providers.keys())}",
        )
    return oauth_providers[provider]()


@router.get("/{provider}/authorize", response_model=OAuthAuthorizeResponse)
async def get_authorization_url(
    provider: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Get OAuth authorization URL to redirect user to provider's consent screen.

    Args:
        provider: OAuth provider name (google, microsoft, slack)

    Returns:
        Authorization URL and state parameter
    """
    oauth_provider = get_oauth_provider(provider)

    # Generate and store state for CSRF protection
    state = oauth_provider.generate_state()

    # Store state and user info in session for callback (check scope to avoid triggering property getter)
    if 'session' in request.scope:
        request.session["oauth_state"] = state
        request.session["oauth_provider"] = provider
        request.session["oauth_user_id"] = str(current_user.user_id)
        request.session["oauth_org_id"] = str(current_user.organization_id)

    authorization_url = oauth_provider.get_authorization_url(state)

    return OAuthAuthorizeResponse(
        authorization_url=authorization_url,
        state=state,
        provider=provider,
    )


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(..., description="Authorization code"),
    state: str = Query(..., description="State parameter"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle OAuth callback from provider.

    Args:
        provider: OAuth provider name
        code: Authorization code from provider
        state: CSRF protection state parameter
        request: FastAPI request object
        db: Database session

    Returns:
        Success message and connection details
    """
    oauth_provider = get_oauth_provider(provider)

    # Validate state parameter (check scope to avoid triggering property getter)
    stored_state = request.session.get("oauth_state") if 'session' in request.scope else None
    if not stored_state or not oauth_provider.validate_state(state, stored_state):
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Get user/org IDs from session
    user_id = request.session.get("oauth_user_id", "default-user") if 'session' in request.scope else "default-user"
    org_id = request.session.get("oauth_org_id", "default-org") if 'session' in request.scope else "default-org"

    try:
        # Exchange code for tokens
        access_token, refresh_token, expires_at = (
            await oauth_provider.exchange_code_for_tokens(code)
        )

        # Get user info from provider
        user_info = await oauth_provider.get_user_info(access_token)

        # Encrypt tokens before storage
        encryption_service = get_encryption_service()
        encrypted_access_token = encryption_service.encrypt(access_token)
        encrypted_refresh_token = (
            encryption_service.encrypt(refresh_token) if refresh_token else None
        )

        # Create connection record
        connection = OAuthConnection(
            connection_id=str(uuid.uuid4()),
            organization_id=org_id,
            user_id=user_id,
            provider=provider,
            access_token=encrypted_access_token,
            refresh_token=encrypted_refresh_token,
            expires_at=expires_at,
            scopes=",".join(oauth_provider.scopes),
            connected_user_email=user_info.get("email"),
            connected_user_name=user_info.get("name"),
            provider_user_id=user_info.get("id") or user_info.get("user_id"),
            status=ConnectionStatus.ACTIVE,
        )

        db.add(connection)
        await db.commit()
        await db.refresh(connection)

        # Clear session (check scope to avoid triggering property getter)
        if 'session' in request.scope:
            request.session.pop("oauth_state", None)
            request.session.pop("oauth_provider", None)
            request.session.pop("oauth_user_id", None)
            request.session.pop("oauth_org_id", None)

        return {
            "success": True,
            "message": f"Successfully connected to {oauth_provider.provider_name}",
            "connection": connection.to_dict(),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth callback failed: {e!s}")


@router.get("/connections", response_model=OAuthConnectionList)
async def list_connections(
    provider: str | None = Query(None, description="Filter by provider"),
    status: str | None = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all OAuth connections for the current user/organization.

    Args:
        provider: Optional provider filter
        status: Optional status filter
        db: Database session

    Returns:
        List of OAuth connections
    """
    org_id = str(current_user.organization_id)

    # Build query
    query = select(OAuthConnection).where(
        OAuthConnection.organization_id == org_id
    )

    if provider:
        query = query.where(OAuthConnection.provider == provider)

    if status:
        query = query.where(OAuthConnection.status == status)

    query = query.order_by(OAuthConnection.created_at.desc())
    result = await db.execute(query)
    connections = result.scalars().all()

    return OAuthConnectionList(
        connections=[conn.to_dict() for conn in connections],
        total=len(connections),
    )


@router.delete("/{provider}/disconnect", response_model=DisconnectResponse)
async def disconnect_provider(
    provider: str,
    connection_id: str = Query(..., description="Connection ID to disconnect"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnect an OAuth connection.

    Args:
        provider: OAuth provider name
        connection_id: Connection ID to disconnect
        db: Database session

    Returns:
        Success message
    """
    org_id = str(current_user.organization_id)

    query = select(OAuthConnection).where(
        OAuthConnection.connection_id == connection_id,
        OAuthConnection.provider == provider,
        OAuthConnection.organization_id == org_id,
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Update status to revoked
    connection.status = ConnectionStatus.REVOKED
    connection.updated_at = datetime.utcnow()

    await db.commit()

    return DisconnectResponse(
        success=True,
        message=f"Successfully disconnected from {provider}",
    )


@router.post("/{provider}/refresh")
async def refresh_token(
    provider: str,
    connection_id: str = Query(..., description="Connection ID to refresh"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh an expired access token.

    Args:
        provider: OAuth provider name
        connection_id: Connection ID to refresh
        db: Database session

    Returns:
        Success message with new expiration
    """
    org_id = str(current_user.organization_id)

    query = select(OAuthConnection).where(
        OAuthConnection.connection_id == connection_id,
        OAuthConnection.provider == provider,
        OAuthConnection.organization_id == org_id,
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if not connection.refresh_token:
        raise HTTPException(status_code=400, detail="No refresh token available")

    try:
        oauth_provider = get_oauth_provider(provider)
        encryption_service = get_encryption_service()

        # Decrypt refresh token
        decrypted_refresh_token = encryption_service.decrypt(connection.refresh_token)

        # Refresh access token
        new_access_token, new_expires_at = await oauth_provider.refresh_access_token(
            decrypted_refresh_token
        )

        # Encrypt and update
        connection.access_token = encryption_service.encrypt(new_access_token)
        connection.expires_at = new_expires_at
        connection.status = ConnectionStatus.ACTIVE
        connection.updated_at = datetime.utcnow()

        await db.commit()

        return {
            "success": True,
            "message": "Token refreshed successfully",
            "expires_at": new_expires_at.isoformat() if new_expires_at else None,
        }

    except Exception as e:
        connection.status = ConnectionStatus.ERROR
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Token refresh failed: {e!s}")


@router.post("/{provider}/sync")
async def sync_connection(
    provider: str,
    connection_id: str = Query(..., description="Connection ID to sync"),
    max_files: int = Query(100, description="Maximum files to sync"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a sync for an OAuth connection.

    Args:
        provider: OAuth provider name
        connection_id: Connection ID to sync
        max_files: Maximum number of files to sync
        db: Database session

    Returns:
        Sync results
    """
    org_id = str(current_user.organization_id)

    # Get connection
    query = select(OAuthConnection).where(
        OAuthConnection.connection_id == connection_id,
        OAuthConnection.provider == provider,
        OAuthConnection.organization_id == org_id,
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Connection is not active")

    # Import sync service based on provider
    if provider == "google":
        from app.services.sync import GoogleDriveSyncService
        sync_service = GoogleDriveSyncService()
        results = await sync_service.sync_connection(connection, db, max_files)
    elif provider == "gmail":
        from app.services.sync import GmailSyncService
        sync_service = GmailSyncService()
        results = await sync_service.sync_connection(connection, db, max_emails=max_files)
    elif provider == "salesforce":
        from app.services.sync import SalesforceSyncService
        sync_service = SalesforceSyncService()
        results = await sync_service.sync_connection(connection, db, max_files)
    else:
        raise HTTPException(status_code=400, detail=f"Sync not implemented for {provider}")

    return results
