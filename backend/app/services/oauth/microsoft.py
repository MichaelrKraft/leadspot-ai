"""Microsoft OAuth service for SharePoint integration"""


import httpx

from .base import BaseOAuthProvider


class MicrosoftOAuthProvider(BaseOAuthProvider):
    """OAuth provider for Microsoft SharePoint via Microsoft Graph API"""

    @property
    def authorization_base_url(self) -> str:
        return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"

    @property
    def token_url(self) -> str:
        return "https://login.microsoftonline.com/common/oauth2/v2.0/token"

    @property
    def scopes(self) -> list[str]:
        return [
            "https://graph.microsoft.com/Sites.Read.All",
            "https://graph.microsoft.com/Files.Read.All",
            "https://graph.microsoft.com/User.Read",
            "offline_access",  # Required for refresh tokens
        ]

    @property
    def provider_name(self) -> str:
        return "Microsoft SharePoint"

    async def get_user_info(self, access_token: str) -> dict:
        """
        Get authenticated Microsoft user information.

        Args:
            access_token: Valid Microsoft access token

        Returns:
            Dictionary containing user email, name, and profile info
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        return {
            "email": data.get("mail") or data.get("userPrincipalName"),
            "name": data.get("displayName"),
            "id": data.get("id"),
        }

    async def list_sites(self, access_token: str) -> dict:
        """
        List SharePoint sites accessible to the user.

        Args:
            access_token: Valid Microsoft access token

        Returns:
            Dictionary containing sites list
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/sites?search=*",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def list_site_drives(self, access_token: str, site_id: str) -> dict:
        """
        List document libraries (drives) in a SharePoint site.

        Args:
            access_token: Valid Microsoft access token
            site_id: SharePoint site ID

        Returns:
            Dictionary containing drives list
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def list_drive_items(self, access_token: str, drive_id: str) -> dict:
        """
        List items in a SharePoint document library.

        Args:
            access_token: Valid Microsoft access token
            drive_id: Drive (document library) ID

        Returns:
            Dictionary containing items list
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()
