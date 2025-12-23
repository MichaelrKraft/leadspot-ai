"""Slack OAuth service for Slack workspace integration"""


import httpx

from .base import BaseOAuthProvider


class SlackOAuthProvider(BaseOAuthProvider):
    """OAuth provider for Slack workspaces"""

    @property
    def authorization_base_url(self) -> str:
        return "https://slack.com/oauth/v2/authorize"

    @property
    def token_url(self) -> str:
        return "https://slack.com/api/oauth.v2.access"

    @property
    def scopes(self) -> list[str]:
        return [
            "channels:history",
            "channels:read",
            "groups:history",
            "groups:read",
            "im:history",
            "im:read",
            "mpim:history",
            "mpim:read",
            "users:read",
            "users:read.email",
        ]

    @property
    def provider_name(self) -> str:
        return "Slack"

    def get_authorization_url(self, state: str) -> str:
        """
        Generate Slack OAuth authorization URL.
        Slack uses different parameter names than standard OAuth.

        Args:
            state: CSRF protection state parameter

        Returns:
            Full authorization URL with all required parameters
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": ",".join(self.scopes),  # Slack uses comma-separated scopes
            "state": state,
            "user_scope": "",  # Can add user-specific scopes if needed
        }

        query_string = "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
        return f"{self.authorization_base_url}?{query_string}"

    async def exchange_code_for_tokens(self, code: str):
        """
        Exchange authorization code for Slack tokens.
        Slack has a different response format.

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Tuple of (access_token, refresh_token, expires_at)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        if not data.get("ok"):
            raise Exception(f"Slack OAuth error: {data.get('error')}")

        # Slack doesn't expire tokens by default, so we return None for expires_at
        access_token = data["access_token"]
        refresh_token = data.get("refresh_token")  # Only with token rotation enabled
        expires_at = None

        return access_token, refresh_token, expires_at

    async def get_user_info(self, access_token: str) -> dict:
        """
        Get authenticated Slack user and workspace information.

        Args:
            access_token: Valid Slack access token

        Returns:
            Dictionary containing user and workspace info
        """
        async with httpx.AsyncClient() as client:
            # Get workspace info
            auth_response = await client.get(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            auth_response.raise_for_status()
            auth_data = auth_response.json()

            if not auth_data.get("ok"):
                raise Exception(f"Slack API error: {auth_data.get('error')}")

            user_id = auth_data.get("user_id")

            # Get user details
            user_response = await client.get(
                "https://slack.com/api/users.info",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"user": user_id},
            )
            user_response.raise_for_status()
            user_data = user_response.json()

            if not user_data.get("ok"):
                raise Exception(f"Slack API error: {user_data.get('error')}")

        user = user_data.get("user", {})
        profile = user.get("profile", {})

        return {
            "email": profile.get("email"),
            "name": profile.get("real_name"),
            "team_id": auth_data.get("team_id"),
            "team_name": auth_data.get("team"),
            "user_id": user_id,
        }

    async def list_conversations(self, access_token: str, limit: int = 100) -> dict:
        """
        List Slack conversations (channels) accessible to the bot.

        Args:
            access_token: Valid Slack access token
            limit: Number of conversations to return

        Returns:
            Dictionary containing conversations list
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://slack.com/api/conversations.list",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "limit": limit,
                    "types": "public_channel,private_channel,mpim,im",
                },
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("ok"):
                raise Exception(f"Slack API error: {data.get('error')}")

            return data

    async def get_conversation_history(
        self, access_token: str, channel_id: str, limit: int = 100
    ) -> dict:
        """
        Get message history for a Slack conversation.

        Args:
            access_token: Valid Slack access token
            channel_id: Channel/conversation ID
            limit: Number of messages to return

        Returns:
            Dictionary containing message history
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://slack.com/api/conversations.history",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"channel": channel_id, "limit": limit},
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("ok"):
                raise Exception(f"Slack API error: {data.get('error')}")

            return data
