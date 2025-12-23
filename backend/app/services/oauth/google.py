"""Google OAuth service for Google Drive integration"""


import httpx

from .base import BaseOAuthProvider


class GoogleOAuthProvider(BaseOAuthProvider):
    """OAuth provider for Google Drive"""

    @property
    def authorization_base_url(self) -> str:
        return "https://accounts.google.com/o/oauth2/v2/auth"

    @property
    def token_url(self) -> str:
        return "https://oauth2.googleapis.com/token"

    @property
    def scopes(self) -> list[str]:
        return [
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ]

    @property
    def provider_name(self) -> str:
        return "Google Drive"

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

    async def list_files(self, access_token: str, page_size: int = 100) -> dict:
        """
        List files from Google Drive.

        Args:
            access_token: Valid Google access token
            page_size: Number of files to return per page

        Returns:
            Dictionary containing files list and pagination info
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/drive/v3/files",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "pageSize": page_size,
                    "fields": "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
                },
            )
            response.raise_for_status()
            return response.json()
