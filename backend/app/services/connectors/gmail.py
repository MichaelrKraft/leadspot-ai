"""Gmail connector for syncing emails"""

import base64
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from .base import BaseConnector, Document


@dataclass
class EmailMessage:
    """Represents an email message with metadata"""
    id: str
    thread_id: str
    subject: str
    from_email: str
    from_name: str
    to_emails: list[str]
    cc_emails: list[str]
    date: datetime
    snippet: str
    body_text: str
    body_html: str
    labels: list[str]
    attachments: list[dict[str, Any]]
    is_unread: bool


class GmailConnector(BaseConnector):
    """Connector for Gmail emails"""

    BASE_URL = "https://gmail.googleapis.com/gmail/v1"

    # Labels to exclude by default (Promotions/Social)
    DEFAULT_EXCLUDED_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"]

    @property
    def connector_name(self) -> str:
        return "Gmail"

    async def list_messages(
        self,
        max_results: int = 100,
        since_date: datetime | None = None,
        labels: list[str] | None = None,
        exclude_labels: list[str] | None = None,
        include_spam_trash: bool = False,
    ) -> list[dict]:
        """
        List email message IDs from Gmail.

        Args:
            max_results: Maximum number of messages to return
            since_date: Only return messages after this date
            labels: Only return messages with these labels
            exclude_labels: Exclude messages with these labels
            include_spam_trash: Include messages in Spam and Trash

        Returns:
            List of message metadata dictionaries (id, threadId)
        """
        messages = []
        page_token = None

        # Build query string
        query_parts = []

        if since_date:
            # Gmail uses format: after:YYYY/MM/DD
            query_parts.append(f"after:{since_date.strftime('%Y/%m/%d')}")

        # Exclude specified labels
        excluded = exclude_labels or self.DEFAULT_EXCLUDED_LABELS
        for label in excluded:
            query_parts.append(f"-label:{label}")

        query = " ".join(query_parts) if query_parts else None

        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(messages) < max_results:
                params = {
                    "maxResults": min(100, max_results - len(messages)),
                    "includeSpamTrash": include_spam_trash,
                }

                if query:
                    params["q"] = query
                if labels:
                    params["labelIds"] = labels
                if page_token:
                    params["pageToken"] = page_token

                response = await client.get(
                    f"{self.BASE_URL}/users/me/messages",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                batch_messages = data.get("messages", [])
                messages.extend(batch_messages)

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        return messages[:max_results]

    async def get_message(self, message_id: str, format: str = "full") -> EmailMessage:
        """
        Get a specific email message with full content.

        Args:
            message_id: Gmail message ID
            format: Response format (minimal, full, raw, metadata)

        Returns:
            EmailMessage object with content and metadata
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/users/me/messages/{message_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"format": format},
            )
            response.raise_for_status()
            data = response.json()

        return self._parse_message(data)

    async def get_thread(self, thread_id: str) -> list[EmailMessage]:
        """
        Get all messages in a thread.

        Args:
            thread_id: Gmail thread ID

        Returns:
            List of EmailMessage objects in the thread
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/users/me/threads/{thread_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"format": "full"},
            )
            response.raise_for_status()
            data = response.json()

        messages = []
        for msg_data in data.get("messages", []):
            messages.append(self._parse_message(msg_data))

        return messages

    async def list_labels(self) -> list[dict]:
        """
        List all Gmail labels.

        Returns:
            List of label dictionaries
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/users/me/labels",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        return data.get("labels", [])

    async def get_attachment(
        self, message_id: str, attachment_id: str
    ) -> dict[str, Any]:
        """
        Download an email attachment.

        Args:
            message_id: Parent message ID
            attachment_id: Attachment ID

        Returns:
            Dictionary with attachment data and metadata
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/users/me/messages/{message_id}/attachments/{attachment_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        # Decode base64 attachment data
        attachment_data = base64.urlsafe_b64decode(data.get("data", ""))

        return {
            "id": attachment_id,
            "size": data.get("size", 0),
            "data": attachment_data,
        }

    def _parse_message(self, data: dict) -> EmailMessage:
        """Parse Gmail API message response into EmailMessage."""
        headers = {}
        payload = data.get("payload", {})

        # Extract headers
        for header in payload.get("headers", []):
            name = header.get("name", "").lower()
            headers[name] = header.get("value", "")

        # Parse from field
        from_field = headers.get("from", "")
        from_name, from_email = self._parse_email_address(from_field)

        # Parse to field
        to_emails = self._parse_email_list(headers.get("to", ""))
        cc_emails = self._parse_email_list(headers.get("cc", ""))

        # Parse date
        date_str = headers.get("date", "")
        date = self._parse_date(date_str)

        # Extract body
        body_text, body_html = self._extract_body(payload)

        # Extract attachments info
        attachments = self._extract_attachments(payload)

        # Check if unread
        labels = data.get("labelIds", [])
        is_unread = "UNREAD" in labels

        return EmailMessage(
            id=data.get("id", ""),
            thread_id=data.get("threadId", ""),
            subject=headers.get("subject", "(No Subject)"),
            from_email=from_email,
            from_name=from_name,
            to_emails=to_emails,
            cc_emails=cc_emails,
            date=date,
            snippet=data.get("snippet", ""),
            body_text=body_text,
            body_html=body_html,
            labels=labels,
            attachments=attachments,
            is_unread=is_unread,
        )

    def _parse_email_address(self, address: str) -> tuple:
        """Parse 'Name <email@example.com>' format."""
        import re
        match = re.match(r'^"?([^"<]*)"?\s*<?([^>]*)>?$', address.strip())
        if match:
            name = match.group(1).strip()
            email = match.group(2).strip() or name  # If no <email>, use the whole string
            return name, email
        return "", address.strip()

    def _parse_email_list(self, addresses: str) -> list[str]:
        """Parse comma-separated email addresses."""
        if not addresses:
            return []
        return [addr.strip() for addr in addresses.split(",") if addr.strip()]

    def _parse_date(self, date_str: str) -> datetime:
        """Parse email date header."""
        from email.utils import parsedate_to_datetime
        try:
            return parsedate_to_datetime(date_str)
        except (ValueError, TypeError):
            return datetime.utcnow()

    def _extract_body(self, payload: dict) -> tuple:
        """Extract plain text and HTML body from message payload."""
        body_text = ""
        body_html = ""

        mime_type = payload.get("mimeType", "")

        # Direct body data
        body_data = payload.get("body", {}).get("data", "")
        if body_data:
            decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
            if "html" in mime_type:
                body_html = decoded
            else:
                body_text = decoded

        # Handle multipart messages
        parts = payload.get("parts", [])
        for part in parts:
            part_mime = part.get("mimeType", "")
            part_data = part.get("body", {}).get("data", "")

            if part_data:
                decoded = base64.urlsafe_b64decode(part_data).decode("utf-8", errors="replace")
                if part_mime == "text/plain":
                    body_text = decoded
                elif part_mime == "text/html":
                    body_html = decoded

            # Recurse into nested parts
            nested_parts = part.get("parts", [])
            if nested_parts:
                nested_text, nested_html = self._extract_body(part)
                body_text = body_text or nested_text
                body_html = body_html or nested_html

        return body_text, body_html

    def _extract_attachments(self, payload: dict) -> list[dict[str, Any]]:
        """Extract attachment metadata from message payload."""
        attachments = []

        parts = payload.get("parts", [])
        for part in parts:
            filename = part.get("filename", "")
            if filename:  # Part has a filename = it's an attachment
                body = part.get("body", {})
                attachments.append({
                    "id": body.get("attachmentId", ""),
                    "filename": filename,
                    "mime_type": part.get("mimeType", ""),
                    "size": body.get("size", 0),
                })

            # Check nested parts
            nested = part.get("parts", [])
            if nested:
                attachments.extend(self._extract_attachments(part))

        return attachments

    # Implement base class method
    async def list_files(
        self,
        folder_id: str | None = None,
        recursive: bool = True,
        max_results: int | None = None,
    ) -> list[dict]:
        """
        List emails (for compatibility with base connector interface).
        Maps to list_messages.
        """
        return await self.list_messages(max_results=max_results or 100)

    async def get_file_content(self, file_id: str) -> Document:
        """
        Get email content (for compatibility with base connector interface).
        Maps to get_message.
        """
        msg = await self.get_message(file_id)

        # Build content for indexing (prefer plain text, fallback to stripped HTML)
        content = msg.body_text
        if not content and msg.body_html:
            import re
            from html import unescape
            # Basic HTML stripping for indexing
            content = re.sub(r'<[^>]+>', ' ', msg.body_html)
            content = unescape(content)
            content = re.sub(r'\s+', ' ', content).strip()

        # Build full document content including metadata for RAG
        full_content = f"""Subject: {msg.subject}
From: {msg.from_name} <{msg.from_email}>
To: {', '.join(msg.to_emails)}
Date: {msg.date.strftime('%B %d, %Y at %I:%M %p') if msg.date else 'Unknown'}

{content}"""

        return Document(
            id=msg.id,
            name=msg.subject,
            content=full_content,
            mime_type="message/rfc822",
            source_url=f"https://mail.google.com/mail/u/0/#inbox/{msg.id}",
            modified_at=msg.date,
            created_at=msg.date,
            size_bytes=len(content.encode("utf-8")),
            metadata={
                "thread_id": msg.thread_id,
                "from_email": msg.from_email,
                "from_name": msg.from_name,
                "to_emails": msg.to_emails,
                "cc_emails": msg.cc_emails,
                "labels": msg.labels,
                "attachments": msg.attachments,
                "is_unread": msg.is_unread,
            },
        )
