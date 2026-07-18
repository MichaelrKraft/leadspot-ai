"""
Gmail REST connector.

Thin httpx client over the Gmail API used by the inbox poller. Supports
cursor-based incremental sync via users.history.list (the same pattern as
Gmail push-less polling clients): getProfile supplies the first historyId,
history.list returns message ids added since a cursor, and a 404 from
history.list means the cursor is too old and the caller must resync to "now".

Bodies are decoded in memory for classification/inference and are never
persisted by callers beyond a capped preview.
"""

import base64
import re
from dataclasses import dataclass, field
from datetime import datetime
from html import unescape
from typing import Any

import httpx

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

# Sentinel returned by list_new_message_ids when the stored cursor is too old.
STALE_CURSOR = "stale"


@dataclass
class GmailMessage:
    """A fetched Gmail message, parsed for the inbox pipeline."""

    id: str
    thread_id: str
    from_address: str
    to_addresses: list[str]
    subject: str
    snippet: str
    body: str  # plain text, truncated by caller policy — in-memory use only
    received_at: datetime | None
    is_inbox: bool
    is_sent: bool
    is_draft: bool
    label_ids: list[str] = field(default_factory=list)


class GmailApiError(Exception):
    """Non-retryable Gmail API failure (auth, quota, bad request)."""


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _find_header(payload: dict[str, Any], name: str) -> str:
    for h in payload.get("headers", []) or []:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "") or ""
    return ""


def _extract_address(raw: str) -> str:
    """'Jane Doe <jane@acme.com>' -> 'jane@acme.com'."""
    m = re.search(r"<([^>]+)>", raw)
    return (m.group(1) if m else raw).strip()


def _extract_addresses(raw: str) -> list[str]:
    return [_extract_address(part) for part in raw.split(",") if part.strip()]


def _decode_b64url(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _extract_text(part: dict[str, Any] | None) -> str:
    """Depth-first text/plain extraction with HTML fallback (tags stripped)."""
    if not part:
        return ""
    if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
        return _decode_b64url(part["body"]["data"])
    for sub in part.get("parts", []) or []:
        text = _extract_text(sub)
        if text:
            return text
    if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
        html = _decode_b64url(part["body"]["data"])
        html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", html)
        return re.sub(r"\s+", " ", unescape(text)).strip()
    return ""


class GmailClient:
    """Gmail API client bound to a single access token (one poll cycle)."""

    def __init__(self, access_token: str, timeout: float = 30.0):
        self._token = access_token
        self._timeout = timeout

    async def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, params=params, headers=_headers(self._token))
            response.raise_for_status()
            return response.json()

    async def current_history_id(self) -> str:
        """The mailbox's current historyId — the bootstrap cursor."""
        data = await self._get(f"{GMAIL_BASE}/profile")
        return str(data["historyId"])

    async def list_new_message_ids(self, start_history_id: str):
        """Message ids added since the cursor.

        Returns ("stale", None) when the cursor is too old (HTTP 404) — the
        caller must resync from current_history_id(). Otherwise returns
        (ids, new_history_id).
        """
        ids: list[str] = []
        seen: set[str] = set()
        new_history_id = start_history_id
        page_token: str | None = None
        try:
            while True:
                params: dict[str, Any] = {
                    "startHistoryId": start_history_id,
                    "historyTypes": "messageAdded",
                }
                if page_token:
                    params["pageToken"] = page_token
                data = await self._get(f"{GMAIL_BASE}/history", params)
                new_history_id = str(data.get("historyId", new_history_id))
                for h in data.get("history", []) or []:
                    for added in h.get("messagesAdded", []) or []:
                        mid = added.get("message", {}).get("id")
                        if mid and mid not in seen:
                            seen.add(mid)
                            ids.append(mid)
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return STALE_CURSOR, None
            raise
        return ids, new_history_id

    async def list_message_ids_since_days(
        self, days: int, max_results: int = 200, extra_query: str = ""
    ) -> list[str]:
        """Recent message ids by query — used only by the one-time backfill.

        extra_query narrows the search (e.g. "in:sent" for style-profile
        source mail).
        """
        ids: list[str] = []
        page_token: str | None = None
        while len(ids) < max_results:
            params: dict[str, Any] = {
                "q": f"newer_than:{days}d {extra_query}".strip(),
                "maxResults": min(100, max_results - len(ids)),
            }
            if page_token:
                params["pageToken"] = page_token
            data = await self._get(f"{GMAIL_BASE}/messages", params)
            ids.extend(m["id"] for m in data.get("messages", []) or [])
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        return ids

    async def get_message(self, message_id: str) -> GmailMessage | None:
        """Fetch and parse one message. Returns None on malformed responses."""
        data = await self._get(f"{GMAIL_BASE}/messages/{message_id}", {"format": "full"})
        if not data.get("id") or not data.get("threadId"):
            return None
        payload = data.get("payload", {}) or {}
        label_ids = data.get("labelIds", []) or []

        received_at: datetime | None = None
        internal_ms = data.get("internalDate")
        if internal_ms:
            received_at = datetime.utcfromtimestamp(int(internal_ms) / 1000)

        return GmailMessage(
            id=data["id"],
            thread_id=data["threadId"],
            from_address=_extract_address(_find_header(payload, "From")),
            to_addresses=_extract_addresses(_find_header(payload, "To")),
            subject=_find_header(payload, "Subject"),
            snippet=data.get("snippet", "") or "",
            body=_extract_text(payload)[:8000],
            received_at=received_at,
            is_inbox="INBOX" in label_ids,
            is_sent="SENT" in label_ids,
            is_draft="DRAFT" in label_ids,
            label_ids=label_ids,
        )
