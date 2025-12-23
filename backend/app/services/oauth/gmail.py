"""Gmail OAuth service for Gmail integration"""


import httpx

from .base import BaseOAuthProvider


class GmailOAuthProvider(BaseOAuthProvider):
    """OAuth provider for Gmail - Read-only email access"""

    @property
    def authorization_base_url(self) -> str:
        return "https://accounts.google.com/o/oauth2/v2/auth"

    @property
    def token_url(self) -> str:
        return "https://oauth2.googleapis.com/token"

    @property
    def scopes(self) -> list[str]:
        return [
            "https://www.googleapis.com/auth/gmail.readonly",      # Read emails
            "https://www.googleapis.com/auth/gmail.labels",        # Read labels
            "https://www.googleapis.com/auth/userinfo.email",      # Get user email
            "https://www.googleapis.com/auth/userinfo.profile",    # Get user name
        ]

    @property
    def provider_name(self) -> str:
        return "Gmail"

    async def get_user_info(self, access_token: str) -> dict:
        """
        Get authenticated Google user information.

        Args:
            access_token: Valid Google access token

        Returns:
            Dictionary containing user email, name, and profile info
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        return {
            "email": data.get("email"),
            "name": data.get("name"),
            "picture": data.get("picture"),
            "verified_email": data.get("verified_email", False),
        }

    async def get_profile(self, access_token: str) -> dict:
        """
        Get Gmail profile information.

        Args:
            access_token: Valid Gmail access token

        Returns:
            Dictionary containing Gmail profile info (email, messages total, etc.)
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def list_labels(self, access_token: str) -> dict:
        """
        List Gmail labels.

        Args:
            access_token: Valid Gmail access token

        Returns:
            Dictionary containing labels list
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/labels",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()
