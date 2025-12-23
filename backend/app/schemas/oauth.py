"""Pydantic schemas for OAuth endpoints"""

from datetime import datetime

from pydantic import BaseModel, Field


class OAuthAuthorizeResponse(BaseModel):
    """Response schema for OAuth authorization URL"""

    authorization_url: str = Field(..., description="OAuth authorization URL to redirect user to")
    state: str = Field(..., description="CSRF protection state parameter")
    provider: str = Field(..., description="OAuth provider name")


class OAuthCallbackRequest(BaseModel):
    """Request schema for OAuth callback"""

    code: str = Field(..., description="Authorization code from OAuth provider")
    state: str = Field(..., description="CSRF protection state parameter")


class OAuthConnection(BaseModel):
    """Schema for OAuth connection information"""

    connection_id: str = Field(..., description="Unique connection identifier")
    organization_id: str = Field(..., description="Organization ID")
    user_id: str = Field(..., description="User ID who created the connection")
    provider: str = Field(..., description="OAuth provider (google, microsoft, slack)")
    scopes: list[str] = Field(..., description="List of granted OAuth scopes")
    connected_user_email: str | None = Field(
        None, description="Email of the connected account"
    )
    connected_user_name: str | None = Field(
        None, description="Name of the connected account"
    )
    status: str = Field(..., description="Connection status (active, expired, revoked, error)")
    expires_at: datetime | None = Field(None, description="When the access token expires")
    last_sync_at: datetime | None = Field(None, description="Last successful sync time")
    last_sync_status: str | None = Field(None, description="Status of last sync")
    documents_synced: int = Field(0, description="Number of documents synced")
    created_at: datetime = Field(..., description="When connection was created")
    updated_at: datetime = Field(..., description="When connection was last updated")

    class Config:
        from_attributes = True


class OAuthConnectionList(BaseModel):
    """Schema for list of OAuth connections"""

    connections: list[OAuthConnection] = Field(..., description="List of OAuth connections")
    total: int = Field(..., description="Total number of connections")


class DisconnectRequest(BaseModel):
    """Request schema for disconnecting an OAuth connection"""

    connection_id: str = Field(..., description="Connection ID to disconnect")


class DisconnectResponse(BaseModel):
    """Response schema for disconnect operation"""

    success: bool = Field(..., description="Whether disconnect was successful")
    message: str = Field(..., description="Success or error message")


class TokenRefreshResponse(BaseModel):
    """Response schema for token refresh operation"""

    success: bool = Field(..., description="Whether refresh was successful")
    expires_at: datetime | None = Field(None, description="New token expiration time")
    message: str = Field(..., description="Success or error message")
