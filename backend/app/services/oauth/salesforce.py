"""Salesforce OAuth service for CRM integration"""

from datetime import datetime, timedelta

import httpx

from .base import BaseOAuthProvider


class SalesforceOAuthProvider(BaseOAuthProvider):
    """OAuth provider for Salesforce CRM"""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        instance_url: str = "https://login.salesforce.com",
    ):
        super().__init__(client_id, client_secret, redirect_uri)
        self.instance_url = instance_url

    @property
    def authorization_base_url(self) -> str:
        return f"{self.instance_url}/services/oauth2/authorize"

    @property
    def token_url(self) -> str:
        return f"{self.instance_url}/services/oauth2/token"

    @property
    def scopes(self) -> list[str]:
        return [
            "api",              # REST API access
            "id",               # User identity info
            "refresh_token",    # Enable token refresh
            "offline_access",   # Enable offline access
        ]

    @property
    def provider_name(self) -> str:
        return "Salesforce"

    async def exchange_code_for_tokens(
        self, code: str
    ) -> tuple[str, str | None, datetime | None]:
        """
        Exchange authorization code for access and refresh tokens.

        Salesforce returns instance_url which we need to store for API calls.

        Args:
            code: Authorization code from Salesforce

        Returns:
            Tuple of (access_token, refresh_token, expires_at)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")

        # Salesforce access tokens typically expire in 2 hours
        # But they don't always return expires_in, so we default to 2 hours
        expires_in = data.get("issued_at")  # Salesforce uses issued_at timestamp
        if expires_in:
            # Convert millisecond timestamp to datetime and add 2 hours
            issued_at = datetime.fromtimestamp(int(expires_in) / 1000)
            expires_at = issued_at + timedelta(hours=2)
        else:
            expires_at = datetime.utcnow() + timedelta(hours=2)

        # Store instance_url for later API calls (returned by Salesforce)
        # This is stored in the access_token metadata
        self._instance_url = data.get("instance_url", self.instance_url)

        return access_token, refresh_token, expires_at

    async def refresh_access_token(
        self, refresh_token: str
    ) -> tuple[str, datetime | None]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            Tuple of (new_access_token, new_expires_at)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        access_token = data.get("access_token")
        expires_at = datetime.utcnow() + timedelta(hours=2)

        return access_token, expires_at

    async def get_user_info(self, access_token: str) -> dict:
        """
        Get authenticated Salesforce user information.

        Args:
            access_token: Valid Salesforce access token

        Returns:
            Dictionary containing user email, name, and profile info
        """
        # Use the stored instance_url if available, otherwise use default
        instance_url = getattr(self, "_instance_url", self.instance_url)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{instance_url}/services/oauth2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        return {
            "id": data.get("user_id"),
            "user_id": data.get("user_id"),
            "email": data.get("email"),
            "name": data.get("name"),
            "picture": data.get("picture"),
            "organization_id": data.get("organization_id"),
            "username": data.get("preferred_username"),
        }

    async def query_records(
        self,
        access_token: str,
        instance_url: str,
        soql_query: str,
    ) -> dict:
        """
        Execute a SOQL query against Salesforce.

        Args:
            access_token: Valid Salesforce access token
            instance_url: Salesforce instance URL
            soql_query: SOQL query string

        Returns:
            Query results dictionary
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{instance_url}/services/data/v59.0/query",
                params={"q": soql_query},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def list_objects(self, access_token: str, instance_url: str) -> dict:
        """
        List all accessible Salesforce objects.

        Args:
            access_token: Valid Salesforce access token
            instance_url: Salesforce instance URL

        Returns:
            Dictionary containing sobjects list
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{instance_url}/services/data/v59.0/sobjects",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def get_record(
        self,
        access_token: str,
        instance_url: str,
        object_type: str,
        record_id: str,
    ) -> dict:
        """
        Get a specific Salesforce record.

        Args:
            access_token: Valid Salesforce access token
            instance_url: Salesforce instance URL
            object_type: Salesforce object type (e.g., Account, Contact, Opportunity)
            record_id: Record ID

        Returns:
            Record data dictionary
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{instance_url}/services/data/v59.0/sobjects/{object_type}/{record_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()
