"""Base OAuth provider class for all OAuth integrations"""

import secrets
from abc import ABC, abstractmethod
from datetime import datetime, timedelta

import httpx


class BaseOAuthProvider(ABC):
    """Abstract base class for OAuth 2.0 providers"""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ):
        """
        Initialize OAuth provider.

        Args:
            client_id: OAuth client ID
            client_secret: OAuth client secret
            redirect_uri: OAuth callback URL
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri

    @property
    @abstractmethod
    def authorization_base_url(self) -> str:
        """URL for initiating OAuth authorization"""
        pass

    @property
    @abstractmethod
    def token_url(self) -> str:
        """URL for exchanging authorization code for tokens"""
        pass

    @property
    @abstractmethod
    def scopes(self) -> list[str]:
        """List of OAuth scopes to request"""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name"""
        pass

    def generate_state(self) -> str:
        """
        Generate a random state parameter for CSRF protection.

        Returns:
            Random state string
        """
        return secrets.token_urlsafe(32)

    def get_authorization_url(self, state: str) -> str:
        """
        Generate OAuth authorization URL.

        Args:
            state: CSRF protection state parameter

        Returns:
            Full authorization URL with all required parameters
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "access_type": "offline",  # Request refresh token
            "prompt": "consent",  # Force consent screen to get refresh token
        }

        query_string = "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
        return f"{self.authorization_base_url}?{query_string}"

    async def exchange_code_for_tokens(
        self, code: str
    ) -> tuple[str, str | None, datetime]:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Tuple of (access_token, refresh_token, expires_at)

        Raises:
            httpx.HTTPError: If token exchange fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        access_token = data["access_token"]
        refresh_token = data.get("refresh_token")
        expires_in = data.get("expires_in", 3600)
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        return access_token, refresh_token, expires_at

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, datetime]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: Valid refresh token

        Returns:
            Tuple of (new_access_token, new_expires_at)

        Raises:
            httpx.HTTPError: If token refresh fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        access_token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        return access_token, expires_at

    async def get_user_info(self, access_token: str) -> dict:
        """
        Get authenticated user information.

        Args:
            access_token: Valid access token

        Returns:
            Dictionary containing user information (email, name, etc.)

        Raises:
            httpx.HTTPError: If user info request fails
        """
        # To be implemented by subclasses if needed
        return {}

    def validate_state(self, received_state: str, stored_state: str) -> bool:
        """
        Validate OAuth state parameter for CSRF protection.

        Args:
            received_state: State parameter from OAuth callback
            stored_state: State parameter stored before redirect

        Returns:
            True if states match, False otherwise
        """
        return secrets.compare_digest(received_state, stored_state)
