"""
Integrations API Router

Provides endpoints for managing external platform integrations
with support for both real OAuth connections and demo mode.
"""

import base64
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.integrations import (
    SyncManager,
    get_demo_sync_manager,
    get_registry,
)
from app.models import User
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ============================================================================
# Pydantic Models
# ============================================================================

class IntegrationInfo(BaseModel):
    """Information about an available integration"""
    provider: str
    name: str
    description: str
    icon: str
    color: str
    is_configured: bool
    demo_available: bool
    supports_webhooks: bool
    status: str


class IntegrationListResponse(BaseModel):
    """Response for listing available integrations"""
    integrations: list[IntegrationInfo]
    total: int


class ConnectionResponse(BaseModel):
    """Response for a connection operation"""
    success: bool
    message: str
    connection_id: str | None = None
    redirect_url: str | None = None


class SyncStatusResponse(BaseModel):
    """Response for sync status"""
    connection_id: str
    provider: str
    status: str
    connected_user: str | None
    last_sync_at: str | None
    last_sync_status: str | None
    documents_synced: int
    total_documents: int


class SyncResultResponse(BaseModel):
    """Response for sync operation"""
    success: bool
    documents_synced: int
    documents_updated: int
    documents_deleted: int
    errors: list[str]


class DemoDocumentResponse(BaseModel):
    """Response for demo document list"""
    documents: list[dict]
    total: int
    provider: str


# ============================================================================
# Integration Discovery Endpoints
# ============================================================================

@router.get("/available", response_model=IntegrationListResponse)
async def list_available_integrations(
    current_user: User = Depends(get_current_user),
):
    """
    List all available integrations and their configuration status.

    Returns integrations with info about whether they're configured
    (have API credentials) and if demo mode is available.
    """
    registry = get_registry()
    integrations = registry.list_available()

    return IntegrationListResponse(
        integrations=[IntegrationInfo(**i) for i in integrations],
        total=len(integrations),
    )


@router.get("/available/public", response_model=IntegrationListResponse)
async def list_available_integrations_public():
    """
    Public endpoint to list available integrations.

    Used for displaying integration options before login.
    """
    registry = get_registry()
    integrations = registry.list_available()

    return IntegrationListResponse(
        integrations=[IntegrationInfo(**i) for i in integrations],
        total=len(integrations),
    )


# ============================================================================
# OAuth Connection Endpoints
# ============================================================================

@router.get("/{provider}/authorize")
async def get_authorization_url(
    provider: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Get OAuth authorization URL for a provider.

    Redirects to provider's consent screen for real connections,
    or to demo callback for demo mode.
    """
    registry = get_registry()
    connector_class = registry.get_connector_class(provider)

    if not connector_class:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    # Check if we should use demo mode
    is_configured = connector_class.is_configured()

    # Generate state with user info encoded (since sessions may not be available)
    state_data = {
        "nonce": str(uuid.uuid4()),
        "user_id": str(current_user.user_id),
        "org_id": str(current_user.organization_id),
        "provider": provider,
    }
    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    # Also store in session if available (for backwards compatibility)
    if 'session' in request.scope:
        request.session["oauth_state"] = state
        request.session["oauth_provider"] = provider
        request.session["oauth_user_id"] = str(current_user.user_id)
        request.session["oauth_org_id"] = str(current_user.organization_id)

    # Get connector instance
    connector = registry.get_connector(
        provider=provider,
        organization_id=str(current_user.organization_id),
    )

    redirect_uri = f"{settings.API_BASE_URL}/api/integrations/{provider}/callback"
    authorization_url = await connector.get_oauth_url(redirect_uri, state)

    return {
        "authorization_url": authorization_url,
        "state": state,
        "provider": provider,
        "is_demo_mode": connector.is_demo_mode,
    }


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(None, description="Authorization code"),
    state: str = Query(..., description="State parameter"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle OAuth callback from provider.

    Works with both real OAuth callbacks and demo mode callbacks.
    """
    registry = get_registry()
    connector_class = registry.get_connector_class(provider)

    if not connector_class:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    # Decode user info from state parameter (base64-encoded JSON)
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state).decode())
        user_id = state_data.get("user_id", "default-user")
        org_id = state_data.get("org_id", "default-org")
    except Exception:
        # Fall back to session if state decoding fails
        stored_state = request.session.get("oauth_state") if 'session' in request.scope else None
        if stored_state and stored_state != state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        user_id = request.session.get("oauth_user_id", "default-user") if 'session' in request.scope else "default-user"
        org_id = request.session.get("oauth_org_id", "default-org") if 'session' in request.scope else "default-org"

    # Get connector instance
    is_demo = not connector_class.is_configured() or code is None
    connector = registry.get_connector(
        provider=provider,
        organization_id=org_id,
        force_demo=is_demo,
    )

    try:
        redirect_uri = f"{settings.API_BASE_URL}/api/integrations/{provider}/callback"
        tokens = await connector.exchange_code(code or "demo", redirect_uri)

        # Create connection record
        from app.services.encryption import get_encryption_service

        encryption_service = get_encryption_service()

        # Encrypt tokens (even demo tokens for consistency)
        encrypted_access_token = encryption_service.encrypt(tokens["access_token"])
        encrypted_refresh_token = (
            encryption_service.encrypt(tokens["refresh_token"])
            if tokens.get("refresh_token")
            else None
        )

        connection = OAuthConnection(
            connection_id=str(uuid.uuid4()),
            organization_id=org_id,
            user_id=user_id,
            provider=provider,
            access_token=encrypted_access_token,
            refresh_token=encrypted_refresh_token,
            expires_at=tokens.get("expires_at"),
            scopes=tokens.get("scope", ""),
            connected_user_email=tokens.get("email", "demo@example.com" if is_demo else None),
            connected_user_name=tokens.get("name", "Demo User" if is_demo else None),
            provider_user_id=tokens.get("team_id"),  # For Slack
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

        # Redirect to frontend success page
        frontend_url = settings.FRONTEND_URL or "http://localhost:3000"
        redirect_url = f"{frontend_url}/settings/integrations?connected={provider}"
        return RedirectResponse(url=redirect_url, status_code=302)

    except Exception as e:
        # On error, redirect to frontend with error message
        frontend_url = settings.FRONTEND_URL or "http://localhost:3000"
        error_url = f"{frontend_url}/settings/integrations?error={e!s}"
        return RedirectResponse(url=error_url, status_code=302)


@router.get("/{provider}/demo-callback")
async def demo_callback(
    provider: str,
    state: str = Query(..., description="State parameter"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle demo mode callback (no real OAuth).

    Creates a demo connection that uses mock data.
    """
    # Reuse the main callback with no code (triggers demo mode)
    return await oauth_callback(
        provider=provider,
        code=None,
        state=state,
        request=request,
        db=db,
    )


# ============================================================================
# Connection Management Endpoints
# ============================================================================

@router.get("/connections")
async def list_connections(
    provider: str | None = Query(None, description="Filter by provider"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all connections for the current organization.
    """
    org_id = str(current_user.organization_id)

    query = select(OAuthConnection).where(
        OAuthConnection.organization_id == org_id
    )

    if provider:
        query = query.where(OAuthConnection.provider == provider)

    query = query.order_by(OAuthConnection.created_at.desc())
    result = await db.execute(query)
    connections = result.scalars().all()

    return {
        "connections": [conn.to_dict() for conn in connections],
        "total": len(connections),
    }


@router.get("/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get sync status for all connections in the organization.
    """
    org_id = str(current_user.organization_id)

    # Use SyncManager to get status
    sync_manager = SyncManager(db)
    statuses = await sync_manager.get_sync_status(org_id)

    return {
        "statuses": statuses,
        "total": len(statuses),
    }


@router.delete("/{provider}/disconnect")
async def disconnect_integration(
    provider: str,
    connection_id: str = Query(..., description="Connection ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnect an integration.
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

    connection.status = ConnectionStatus.REVOKED
    connection.updated_at = datetime.utcnow()

    await db.commit()

    return {
        "success": True,
        "message": f"Disconnected from {provider}",
    }


# ============================================================================
# Sync Endpoints
# ============================================================================

@router.post("/{provider}/sync")
async def sync_integration(
    provider: str,
    connection_id: str = Query(..., description="Connection ID to sync"),
    full_sync: bool = Query(False, description="Force full sync"),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a sync for a connected integration.

    By default, performs an incremental sync. Set full_sync=true
    to re-sync all documents.
    """
    org_id = str(current_user.organization_id)

    # Verify connection belongs to org
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

    # Perform sync
    sync_manager = SyncManager(db)
    result = await sync_manager.sync_connection(connection_id, full_sync)

    return SyncResultResponse(
        success=result.success,
        documents_synced=result.documents_synced,
        documents_updated=result.documents_updated,
        documents_deleted=result.documents_deleted,
        errors=result.errors,
    )


@router.post("/sync-all")
async def sync_all_integrations(
    full_sync: bool = Query(False, description="Force full sync"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sync all connected integrations for the organization.
    """
    org_id = str(current_user.organization_id)

    sync_manager = SyncManager(db)
    results = await sync_manager.sync_all_connections(org_id, full_sync)

    # Aggregate results
    total_synced = sum(r.documents_synced for r in results.values())
    total_updated = sum(r.documents_updated for r in results.values())
    all_errors = []
    for provider, r in results.items():
        for error in r.errors:
            all_errors.append(f"[{provider}] {error}")

    return {
        "success": len(all_errors) == 0,
        "providers_synced": list(results.keys()),
        "total_documents_synced": total_synced,
        "total_documents_updated": total_updated,
        "errors": all_errors,
    }


# ============================================================================
# Demo Mode Endpoints
# ============================================================================

@router.post("/demo/{provider}/connect")
async def create_demo_connection(
    provider: str,
    current_user: User = Depends(get_current_user),
):
    """
    Create a demo connection for testing without real OAuth.

    This allows testing the integration UI and sync flow
    without actual API credentials.
    """
    registry = get_registry()
    connector_class = registry.get_connector_class(provider)

    if not connector_class:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    config = connector_class.get_config()
    if not config.demo_available:
        raise HTTPException(status_code=400, detail=f"Demo mode not available for {provider}")

    org_id = str(current_user.organization_id)

    # Create demo connection
    demo_manager = get_demo_sync_manager()
    connection = demo_manager.create_demo_connection(org_id, provider)

    return ConnectionResponse(
        success=True,
        message=f"Demo connection created for {config.name}",
        connection_id=connection["connection_id"],
    )


@router.post("/demo/{provider}/sync")
async def sync_demo_connection(
    provider: str,
    connection_id: str = Query(..., description="Demo connection ID"),
    current_user: User = Depends(get_current_user),
):
    """
    Sync a demo connection to get sample documents.
    """
    demo_manager = get_demo_sync_manager()

    # Verify connection exists
    connection = demo_manager.get_demo_connection(connection_id)
    if not connection:
        raise HTTPException(status_code=404, detail="Demo connection not found")

    if connection["provider"] != provider:
        raise HTTPException(status_code=400, detail="Provider mismatch")

    result = await demo_manager.sync_demo_connection(connection_id)

    return SyncResultResponse(
        success=result.success,
        documents_synced=result.documents_synced,
        documents_updated=result.documents_updated,
        documents_deleted=result.documents_deleted,
        errors=result.errors,
    )


@router.get("/demo/{provider}/documents")
async def get_demo_documents(
    provider: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get documents from a demo connection.
    """
    org_id = str(current_user.organization_id)
    demo_manager = get_demo_sync_manager()

    documents = demo_manager.get_demo_documents(org_id)

    # Filter by provider if needed
    provider_docs = [
        doc for doc in documents
        # Demo docs don't have provider field, but we can check by source
    ]

    return DemoDocumentResponse(
        documents=documents,
        total=len(documents),
        provider=provider,
    )


@router.get("/demo/connections")
async def list_demo_connections(
    current_user: User = Depends(get_current_user),
):
    """
    List all demo connections for the organization.
    """
    org_id = str(current_user.organization_id)
    demo_manager = get_demo_sync_manager()

    connections = demo_manager.list_demo_connections(org_id)

    return {
        "connections": connections,
        "total": len(connections),
    }


# ============================================================================
# Document Indexing Endpoints
# ============================================================================

@router.post("/index-pending")
async def index_pending_documents(
    limit: int = Query(100, description="Max documents to index in this batch"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Index all pending documents for the organization.

    This processes synced documents that haven't been embedded yet,
    making them searchable.
    """
    from app.models.document import Document
    from app.services import vector_service

    org_id = str(current_user.organization_id)

    # Get pending documents
    query = select(Document).where(
        Document.organization_id == org_id,
        Document.status == "pending",
        Document.content.isnot(None),
    ).limit(limit)

    result = await db.execute(query)
    documents = result.scalars().all()

    indexed_count = 0
    errors = []

    for doc in documents:
        try:
            # Index the document
            await vector_service.index_document(
                document_id=doc.document_id,
                organization_id=org_id,
                title=doc.title or "Untitled",
                content=doc.content
            )

            # Update status
            doc.status = "indexed"
            indexed_count += 1

        except Exception as e:
            errors.append(f"{doc.document_id}: {str(e)[:100]}")

    await db.commit()

    return {
        "success": len(errors) == 0,
        "documents_indexed": indexed_count,
        "documents_remaining": max(0, len(documents) - indexed_count),
        "errors": errors[:10],  # Limit error messages
    }
