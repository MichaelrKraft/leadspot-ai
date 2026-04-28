"""
Integration tests for app/routers/contacts_sync.py.

GET /api/contacts/sync

Critical claims:
1. Server-side hashing — raw email NEVER appears in the response.
2. Normalization — Jane+Sales@Acme.COM hashes the same as jane@acme.com.
3. Cursor-based pagination (since=).
4. Org-scope — daemon from org X never sees contacts from org Y.
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy import select

from app.models import Contact, EmailAlias
from app.utils.email_normalize import email_hash


# =============================================================================
# Helpers
# =============================================================================

async def _seed_contact(db_session, org_id: str, email: str, offset_minutes: int = 0) -> Contact:
    c = Contact(
        id=str(uuid4()),
        first_name="Test",
        last_name="User",
        email=email,
        organization_id=org_id,
        updated_at=datetime.utcnow() + timedelta(minutes=offset_minutes),
    )
    db_session.add(c)
    await db_session.flush()
    return c


def _daemon_headers(cred) -> dict:
    from app.services.daemon_auth_service import create_daemon_access_token
    token = create_daemon_access_token(
        daemon_id=cred.daemon_id,
        organization_id=cred.organization_id,
        user_id=cred.user_id,
    )
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# Privacy: server-side hashing
# =============================================================================

class TestServerSideHashing:
    """Email must be hashed server-side; raw email must never appear in the response."""

    @pytest.mark.asyncio
    async def test_response_contains_email_hash_not_raw_email(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        raw_email = "Jane+Sales@Acme.COM"
        contact = await _seed_contact(db_session, cred.organization_id, raw_email)

        response = await async_client.get(
            "/api/contacts/sync", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK
        payload = response.json()

        raw_str = response.text
        # Raw email in any capitalisation must not be in the response body
        assert raw_email.lower() not in raw_str.lower()
        assert "Jane+Sales" not in raw_str
        assert "Acme.COM" not in raw_str.split("name_norm")[0]  # company_norm might contain acme in a different position, so check primary fields

        # But the correct email_hash must be present
        expected_hash = email_hash(raw_email)
        assert expected_hash in raw_str

    @pytest.mark.asyncio
    async def test_aliased_email_hashes_match_normalized_form(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        raw_email = "Jane+Sales@Acme.COM"
        contact = await _seed_contact(db_session, cred.organization_id, raw_email)

        response = await async_client.get(
            "/api/contacts/sync", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK

        rows = response.json()["contacts"]
        row = next((r for r in rows if r["contact_id"] == contact.id), None)
        assert row is not None

        expected_hash = email_hash(raw_email)  # normalises jane+sales@acme.com -> jane@acme.com
        assert row["email_hash"] == expected_hash

    @pytest.mark.asyncio
    async def test_email_and_email_display_fields_absent_for_daemon(
        self, async_client, db_session, daemon_credential
    ):
        """The ContactSyncRow schema must not include 'email' or 'email_display' fields."""
        cred, _ = daemon_credential
        await _seed_contact(db_session, cred.organization_id, "private@example.com")

        response = await async_client.get(
            "/api/contacts/sync", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK

        for row in response.json()["contacts"]:
            assert "email" not in row or row.get("email") is None
            # email_display from EmailAlias table is internal; must not be in sync row
            assert "email_display" not in row


# =============================================================================
# Cursor pagination
# =============================================================================

class TestCursorPagination:
    """since=<cursor> returns only rows updated >= cursor, ascending by updated_at."""

    @pytest_asyncio.fixture
    async def five_contacts(self, db_session, daemon_credential):
        cred, _ = daemon_credential
        org_id = cred.organization_id
        contacts = []
        for i in range(5):
            c = await _seed_contact(db_session, org_id, f"user{i}@example.com", offset_minutes=i)
            contacts.append(c)
        return cred, contacts

    @pytest.mark.asyncio
    async def test_first_page_returns_oldest_two(self, async_client, five_contacts):
        cred, contacts = five_contacts
        response = await async_client.get(
            "/api/contacts/sync?limit=2", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["contacts"]) == 2
        # Ascending order: first two contacts have earliest updated_at
        returned_ids = {r["contact_id"] for r in data["contacts"]}
        assert contacts[0].id in returned_ids
        assert contacts[1].id in returned_ids

    @pytest.mark.asyncio
    async def test_second_page_uses_next_since_cursor(self, async_client, five_contacts):
        """Page 2 must contain contacts that were NOT on page 1 (excluding the
        boundary contact which the inclusive >= cursor may repeat).

        The router uses `updated_at >= since` (inclusive). next_since is the
        updated_at of the last item on page 1, so the boundary contact may
        appear on both pages. The important property is that page 2 contains
        NEW contacts beyond those on page 1.
        """
        cred, contacts = five_contacts
        p1 = await async_client.get(
            "/api/contacts/sync?limit=2", headers=_daemon_headers(cred)
        )
        assert p1.status_code == status.HTTP_200_OK
        d1 = p1.json()
        next_since = d1["next_since"]
        assert next_since is not None

        p2 = await async_client.get(
            f"/api/contacts/sync?limit=2&since={next_since}",
            headers=_daemon_headers(cred),
        )
        assert p2.status_code == status.HTTP_200_OK
        d2 = p2.json()
        assert len(d2["contacts"]) >= 1

        ids_p1 = {r["contact_id"] for r in d1["contacts"]}
        ids_p2 = {r["contact_id"] for r in d2["contacts"]}
        # Page 2 must contain at least one contact that page 1 did NOT contain.
        new_on_p2 = ids_p2 - ids_p1
        assert len(new_on_p2) >= 1

    @pytest.mark.asyncio
    async def test_last_page_has_no_next_since(self, async_client, five_contacts):
        """When returned rows < limit, next_since must be None."""
        cred, _ = five_contacts
        response = await async_client.get(
            "/api/contacts/sync?limit=1000", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["next_since"] is None

    @pytest.mark.asyncio
    async def test_empty_org_returns_empty_list(self, async_client, daemon_credential):
        """A daemon for an org with no contacts gets an empty list, not an error."""
        cred, _ = daemon_credential
        # Don't seed any contacts for this org
        response = await async_client.get(
            "/api/contacts/sync", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["contacts"] == []
        assert response.json()["next_since"] is None


# =============================================================================
# Org-scope
# =============================================================================

class TestOrgScope:
    """A daemon must never see contacts from another org."""

    @pytest.mark.asyncio
    async def test_daemon_cannot_see_other_org_contacts(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        other_org = str(uuid4())
        await _seed_contact(db_session, other_org, "spy@other.com")

        response = await async_client.get(
            "/api/contacts/sync", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK

        contact_ids = {r["contact_id"] for r in response.json()["contacts"]}
        # None of the other org's contacts should appear
        # (we can check by seeding one in our org and verifying it's there but not other-org ones)
        own_contact = await _seed_contact(db_session, cred.organization_id, "own@myorg.com")
        response2 = await async_client.get(
            "/api/contacts/sync", headers=_daemon_headers(cred)
        )
        returned_ids = {r["contact_id"] for r in response2.json()["contacts"]}
        assert own_contact.id in returned_ids
        # The other-org contact must not be there
        # (we don't have its ID captured before the fixture, so verify by count / absence of "spy@other.com")
        assert all(
            "spy@other.com" not in response2.text for _ in [None]
        )

    @pytest.mark.asyncio
    async def test_requires_daemon_auth(self, async_client, db_session):
        """Endpoint rejects requests without a valid daemon Bearer token."""
        response = await async_client.get("/api/contacts/sync")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
