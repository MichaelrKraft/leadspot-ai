"""
Slack Integration Connector

Connects to Slack via OAuth 2.0 to sync messages and files.
Supports both real API mode (with credentials) and demo mode (without).

Features:
- Full sync of public channels
- Incremental sync using timestamps
- File attachments from messages
- Thread context preservation
"""

import logging
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Any

from app.config import settings
from app.integrations.base import (
    BaseConnector,
    ConnectorStatus,
    IntegrationConfig,
    SyncedDocument,
)
from app.integrations.demo_data import get_slack_demo_messages

logger = logging.getLogger(__name__)


class SlackConnector(BaseConnector):
    """
    Slack connector for syncing messages and files.

    Supports:
    - Public channel messages
    - Private channels (if bot is invited)
    - Direct messages (if authorized)
    - File attachments
    - Thread conversations
    """

    config = IntegrationConfig(
        provider="slack",
        name="Slack",
        description="Sync messages and files from Slack channels and conversations",
        icon="slack",
        color="#4A154B",
        scopes=[
            "channels:history",
            "channels:read",
            "files:read",
            "groups:history",
            "groups:read",
            "im:history",
            "im:read",
            "mpim:history",
            "mpim:read",
            "users:read",
        ],
        supports_webhooks=True,
        supports_incremental_sync=True,
        demo_available=True,
    )

    # Slack API endpoints
    AUTH_URL = "https://slack.com/oauth/v2/authorize"
    TOKEN_URL = "https://slack.com/api/oauth.v2.access"
    API_BASE = "https://slack.com/api"

    @classmethod
    def get_config(cls) -> IntegrationConfig:
        return cls.config

    @classmethod
    def is_configured(cls) -> bool:
        """Check if Slack OAuth credentials are configured"""
        return bool(settings.SLACK_CLIENT_ID and settings.SLACK_CLIENT_SECRET)

    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """Generate Slack OAuth authorization URL"""
        if self._demo_mode:
            return f"/api/integrations/slack/demo-callback?state={state}"

        params = {
            "client_id": settings.SLACK_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": ",".join(self.config.scopes),
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.AUTH_URL}?{query}"

    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange authorization code for tokens"""
        if self._demo_mode:
            return self._get_demo_tokens()

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.TOKEN_URL,
                    data={
                        "client_id": settings.SLACK_CLIENT_ID,
                        "client_secret": settings.SLACK_CLIENT_SECRET,
                        "code": code,
                        "redirect_uri": redirect_uri,
                    },
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("ok"):
                    raise ValueError(f"Slack OAuth error: {data.get('error')}")

                return {
                    "access_token": data["access_token"],
                    "refresh_token": data.get("refresh_token"),
                    "expires_at": datetime.utcnow() + timedelta(hours=12),  # Slack tokens don't expire but we refresh anyway
                    "token_type": "Bearer",
                    "scope": data.get("scope", ""),
                    "team_id": data.get("team", {}).get("id"),
                    "team_name": data.get("team", {}).get("name"),
                }

        except Exception as e:
            logger.error(f"Slack OAuth token exchange failed: {e}")
            raise

    async def refresh_access_token(self) -> dict[str, Any]:
        """Refresh the access token (Slack tokens typically don't expire)"""
        if self._demo_mode:
            return self._get_demo_tokens()

        # Slack bot tokens don't typically expire, but user tokens might
        # For bot tokens, we just return the existing token
        if self.access_token:
            return {
                "access_token": self.access_token,
                "expires_at": datetime.utcnow() + timedelta(hours=12),
            }

        raise ValueError("No access token available")

    async def validate_connection(self) -> bool:
        """Validate the OAuth connection"""
        if self._demo_mode:
            self._status = ConnectorStatus.CONNECTED
            return True

        if not self.access_token:
            self._status = ConnectorStatus.DISCONNECTED
            return False

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.API_BASE}/auth.test",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )
                data = response.json()

                if data.get("ok"):
                    self._status = ConnectorStatus.CONNECTED
                    return True
                else:
                    self._status = ConnectorStatus.ERROR
                    return False

        except Exception as e:
            logger.error(f"Slack connection validation failed: {e}")
            self._status = ConnectorStatus.ERROR
            return False

    async def sync_all(self) -> AsyncIterator[SyncedDocument]:
        """Sync all messages from Slack"""
        if self._demo_mode:
            async for doc in self._generate_demo_documents():
                yield doc
            return

        self._status = ConnectorStatus.SYNCING
        count = 0

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                # Get list of channels
                channels = await self._get_channels(client)

                for channel in channels:
                    channel_id = channel["id"]
                    channel_name = channel.get("name", "unknown")

                    # Get messages from channel
                    async for doc in self._sync_channel_messages(client, channel_id, channel_name):
                        count += 1
                        self._log_sync_progress(count)
                        yield doc

            self._status = ConnectorStatus.CONNECTED
            logger.info(f"Slack sync completed: {count} messages")

        except Exception as e:
            self._handle_error(e, "Full sync failed")
            raise

    async def sync_incremental(
        self,
        since: datetime | None = None,
        sync_token: str | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """Sync only new messages since last sync"""
        if self._demo_mode:
            # In demo mode, return a subset of messages as "new"
            docs = get_slack_demo_messages()
            for doc in docs[:3]:  # Return first 3 as "new"
                yield doc
            return

        self._status = ConnectorStatus.SYNCING

        try:
            import httpx

            # Convert since datetime to Slack timestamp
            oldest = None
            if since:
                oldest = str(since.timestamp())

            async with httpx.AsyncClient() as client:
                channels = await self._get_channels(client)

                for channel in channels:
                    channel_id = channel["id"]
                    channel_name = channel.get("name", "unknown")

                    async for doc in self._sync_channel_messages(
                        client, channel_id, channel_name, oldest=oldest
                    ):
                        yield doc

            self._status = ConnectorStatus.CONNECTED

        except Exception as e:
            self._handle_error(e, "Incremental sync failed")
            raise

    async def get_document(self, source_id: str) -> SyncedDocument | None:
        """Get a single message by ID"""
        if self._demo_mode:
            docs = get_slack_demo_messages()
            for doc in docs:
                if doc.source_id == source_id:
                    return doc
            return None

        # source_id format: "channel_id:message_ts"
        try:
            parts = source_id.split(":")
            if len(parts) != 2:
                return None

            channel_id, message_ts = parts

            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/conversations.history",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={
                        "channel": channel_id,
                        "oldest": message_ts,
                        "latest": message_ts,
                        "inclusive": "true",
                        "limit": 1,
                    },
                )
                data = response.json()

                if not data.get("ok") or not data.get("messages"):
                    return None

                message = data["messages"][0]
                return await self._process_message(client, channel_id, "unknown", message)

        except Exception as e:
            logger.error(f"Failed to get message {source_id}: {e}")
            return None

    async def _get_channels(self, client) -> list[dict]:
        """Get list of accessible channels"""
        channels = []
        cursor = None

        while True:
            params = {"types": "public_channel,private_channel", "limit": 200}
            if cursor:
                params["cursor"] = cursor

            response = await client.get(
                f"{self.API_BASE}/conversations.list",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params=params,
            )
            data = response.json()

            if not data.get("ok"):
                logger.error(f"Failed to list channels: {data.get('error')}")
                break

            channels.extend(data.get("channels", []))

            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break

        return channels

    async def _sync_channel_messages(
        self,
        client,
        channel_id: str,
        channel_name: str,
        oldest: str | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """Sync messages from a single channel"""
        cursor = None

        while True:
            params = {"channel": channel_id, "limit": 200}
            if cursor:
                params["cursor"] = cursor
            if oldest:
                params["oldest"] = oldest

            response = await client.get(
                f"{self.API_BASE}/conversations.history",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params=params,
            )
            data = response.json()

            if not data.get("ok"):
                logger.warning(f"Failed to get messages for {channel_name}: {data.get('error')}")
                break

            for message in data.get("messages", []):
                # Skip bot messages and system messages
                if message.get("subtype") in ["bot_message", "channel_join", "channel_leave"]:
                    continue

                doc = await self._process_message(client, channel_id, channel_name, message)
                if doc:
                    yield doc

            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break

    async def _process_message(
        self,
        client,
        channel_id: str,
        channel_name: str,
        message: dict
    ) -> SyncedDocument | None:
        """Process a single message into a SyncedDocument"""
        try:
            message_ts = message.get("ts", "")
            user_id = message.get("user", "unknown")
            text = message.get("text", "")

            # Skip empty messages
            if not text.strip():
                return None

            # Get user info for author name
            author = await self._get_user_name(client, user_id)

            # Build content including thread replies if any
            content = text
            thread_ts = message.get("thread_ts")
            if thread_ts and thread_ts == message_ts:
                # This is a thread parent, include replies
                replies = await self._get_thread_replies(client, channel_id, thread_ts)
                if replies:
                    content += "\n\n--- Thread Replies ---\n"
                    content += "\n".join(replies)

            # Parse timestamp
            ts_float = float(message_ts)
            created_at = datetime.fromtimestamp(ts_float)

            # Build source URL
            # Note: This format works for most Slack workspaces
            source_url = f"https://slack.com/archives/{channel_id}/p{message_ts.replace('.', '')}"

            return SyncedDocument(
                source_id=f"{channel_id}:{message_ts}",
                title=f"#{channel_name} - {author} ({created_at.strftime('%Y-%m-%d %H:%M')})",
                content=content,
                mime_type="text/plain",
                file_size=len(content),
                source_url=source_url,
                author=author,
                created_at=created_at,
                modified_at=created_at,  # Slack messages aren't edited often
                metadata={
                    "channel_id": channel_id,
                    "channel_name": channel_name,
                    "message_ts": message_ts,
                    "user_id": user_id,
                    "has_thread": bool(message.get("reply_count")),
                    "reply_count": message.get("reply_count", 0),
                },
            )

        except Exception as e:
            logger.error(f"Failed to process message: {e}")
            return None

    async def _get_user_name(self, client, user_id: str) -> str:
        """Get user display name from ID"""
        if user_id == "unknown":
            return "Unknown User"

        try:
            response = await client.get(
                f"{self.API_BASE}/users.info",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"user": user_id},
            )
            data = response.json()

            if data.get("ok"):
                user = data.get("user", {})
                # Prefer display name, fall back to real name, then username
                return (
                    user.get("profile", {}).get("display_name") or
                    user.get("real_name") or
                    user.get("name") or
                    "Unknown User"
                )
        except Exception as e:
            logger.debug(f"Failed to get user info for {user_id}: {e}")

        return "Unknown User"

    async def _get_thread_replies(
        self,
        client,
        channel_id: str,
        thread_ts: str
    ) -> list[str]:
        """Get replies in a thread"""
        replies = []

        try:
            response = await client.get(
                f"{self.API_BASE}/conversations.replies",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={
                    "channel": channel_id,
                    "ts": thread_ts,
                    "limit": 50,  # Limit thread depth
                },
            )
            data = response.json()

            if data.get("ok"):
                messages = data.get("messages", [])
                # Skip first message (it's the parent)
                for msg in messages[1:]:
                    user = msg.get("user", "unknown")
                    text = msg.get("text", "")
                    if text:
                        author = await self._get_user_name(client, user)
                        replies.append(f"[{author}]: {text}")

        except Exception as e:
            logger.debug(f"Failed to get thread replies: {e}")

        return replies

    async def _generate_demo_documents(self) -> AsyncIterator[SyncedDocument]:
        """Generate demo documents for Slack"""
        docs = get_slack_demo_messages()
        for doc in docs:
            yield doc

    def _get_demo_tokens(self) -> dict[str, Any]:
        """Return fake tokens for demo mode"""
        return {
            "access_token": "demo_access_token_slack",
            "refresh_token": "demo_refresh_token_slack",
            "expires_at": datetime.utcnow() + timedelta(hours=12),
            "token_type": "Bearer",
            "scope": ",".join(self.config.scopes),
            "team_id": "T_DEMO",
            "team_name": "Demo Workspace",
        }
