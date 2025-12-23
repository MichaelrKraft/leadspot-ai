"""Slack connector for syncing messages and conversations"""

from datetime import datetime

import httpx

from .base import BaseConnector, Document


class SlackConnector(BaseConnector):
    """Connector for Slack workspace messages"""

    BASE_URL = "https://slack.com/api"

    @property
    def connector_name(self) -> str:
        return "Slack"

    async def list_conversations(self) -> list[dict]:
        """
        List all accessible conversations (channels).

        Returns:
            List of conversation metadata
        """
        conversations = []
        cursor = None

        async with httpx.AsyncClient() as client:
            while True:
                params = {
                    "types": "public_channel,private_channel,mpim,im",
                    "limit": 200,
                }
                if cursor:
                    params["cursor"] = cursor

                response = await client.get(
                    f"{self.BASE_URL}/conversations.list",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("ok"):
                    raise Exception(f"Slack API error: {data.get('error')}")

                conversations.extend(data.get("channels", []))

                cursor = data.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break

        return conversations

    async def list_files(
        self,
        folder_id: str | None = None,
        recursive: bool = True,
        max_results: int | None = None,
    ) -> list[dict]:
        """
        List conversations (treated as 'files' for consistency).

        Args:
            folder_id: Optional channel ID to list (if None, lists all)
            recursive: Not used for Slack
            max_results: Maximum number of results to return

        Returns:
            List of conversation metadata dictionaries
        """
        if folder_id:
            # Get specific conversation
            conversation = await self._get_conversation_info(folder_id)
            return [conversation] if conversation else []
        else:
            # Get all conversations
            conversations = await self.list_conversations()
            return conversations[: max_results] if max_results else conversations

    async def _get_conversation_info(self, channel_id: str) -> dict | None:
        """
        Get information about a specific conversation.

        Args:
            channel_id: Channel/conversation ID

        Returns:
            Conversation metadata or None
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/conversations.info",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"channel": channel_id},
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("ok"):
                return None

            return data.get("channel")

    async def get_file_content(self, file_id: str) -> Document:
        """
        Get messages from a Slack conversation.

        Args:
            file_id: Channel/conversation ID

        Returns:
            Document object with conversation messages
        """
        # Get conversation info
        conversation = await self._get_conversation_info(file_id)
        if not conversation:
            raise ValueError(f"Conversation {file_id} not found")

        # Get conversation messages
        messages = await self.get_conversation_history(file_id)

        # Format messages as text
        content_parts = []
        for msg in messages:
            timestamp = datetime.fromtimestamp(float(msg.get("ts", 0)))
            user = msg.get("user", "Unknown")
            text = msg.get("text", "")

            content_parts.append(f"[{timestamp}] {user}: {text}")

            # Include thread replies if present
            if msg.get("thread_ts"):
                thread_messages = await self.get_thread_messages(
                    file_id, msg["thread_ts"]
                )
                for thread_msg in thread_messages:
                    thread_ts = datetime.fromtimestamp(float(thread_msg.get("ts", 0)))
                    thread_user = thread_msg.get("user", "Unknown")
                    thread_text = thread_msg.get("text", "")
                    content_parts.append(f"  ↳ [{thread_ts}] {thread_user}: {thread_text}")

        content = "\n".join(content_parts)

        return Document(
            id=file_id,
            name=conversation.get("name", f"Channel {file_id}"),
            content=content,
            mime_type="text/plain",
            source_url=None,
            modified_at=None,
            created_at=datetime.fromtimestamp(conversation.get("created", 0)),
            size_bytes=len(content),
            metadata=conversation,
        )

    async def get_conversation_history(
        self, channel_id: str, limit: int = 1000
    ) -> list[dict]:
        """
        Get message history for a conversation.

        Args:
            channel_id: Channel/conversation ID
            limit: Maximum number of messages to return

        Returns:
            List of message objects
        """
        messages = []
        cursor = None

        async with httpx.AsyncClient() as client:
            while len(messages) < limit:
                params = {"channel": channel_id, "limit": min(200, limit - len(messages))}
                if cursor:
                    params["cursor"] = cursor

                response = await client.get(
                    f"{self.BASE_URL}/conversations.history",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("ok"):
                    raise Exception(f"Slack API error: {data.get('error')}")

                messages.extend(data.get("messages", []))

                cursor = data.get("response_metadata", {}).get("next_cursor")
                if not cursor or not data.get("has_more"):
                    break

        return messages

    async def get_thread_messages(
        self, channel_id: str, thread_ts: str
    ) -> list[dict]:
        """
        Get messages in a thread.

        Args:
            channel_id: Channel/conversation ID
            thread_ts: Thread timestamp

        Returns:
            List of thread message objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/conversations.replies",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"channel": channel_id, "ts": thread_ts},
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("ok"):
                raise Exception(f"Slack API error: {data.get('error')}")

            return data.get("messages", [])

    async def setup_events_subscription(
        self, webhook_url: str, event_types: list[str] | None = None
    ) -> dict:
        """
        Set up Events API subscription for real-time updates.

        Note: This requires Slack app configuration and verification.
        See: https://api.slack.com/events-api

        Args:
            webhook_url: URL to receive event notifications
            event_types: List of event types to subscribe to

        Returns:
            Subscription configuration
        """
        # This is typically done through Slack App configuration
        # Not available via OAuth API
        return {
            "info": "Events API subscription must be configured in Slack App settings",
            "webhook_url": webhook_url,
            "event_types": event_types
            or ["message.channels", "message.groups", "message.im", "message.mpim"],
        }

    async def get_user_info(self, user_id: str) -> dict:
        """
        Get information about a Slack user.

        Args:
            user_id: Slack user ID

        Returns:
            User information
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/users.info",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"user": user_id},
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("ok"):
                raise Exception(f"Slack API error: {data.get('error')}")

            return data.get("user", {})
