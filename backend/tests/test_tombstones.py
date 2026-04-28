"""
Integration tests for app/routers/tombstones.py.

GET /api/tombstones

Covers:
- Org-scope: only returns tombstones for the authenticated daemon's org.
- Cursor pagination by issued_at (ascending).
- Requires daemon auth.
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status

from app.models import SignalTombstone


# =============================================================================
# Helpers
# =============================================================================

def _daemon_headers(cred) -> dict:
    from app.services.daemon_auth_service import create_daemon_access_token
    token = create_daemon_access_token(
        daemon_id=cred.daemon_id,
        organization_id=cred.organization_id,
        user_id=cred.user_id,
    )
    return {"Authorization": f"Bearer {token}"}


async def _seed_tombstone(db_session, org_id: str, offset_seconds: int = 0) -> SignalTombstone:
    t = SignalTombstone(
        id=str(uuid4()),
        organization_id=org_id,
        tombstone_type="signal",
        signal_id=str(uuid4()),
        issued_at=datetime.utcnow() + timedelta(seconds=offset_seconds),
    )
    db_session.add(t)
    await db_session.flush()
    return t


# =============================================================================
# Org-scope
# =============================================================================

class TestTombstonesOrgScope:
    """Daemons can only see tombstones from their own org."""

    @pytest.mark.asyncio
    async def test_returns_only_own_org_tombstones(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        other_org = str(uuid4())

        own_t = await _seed_tombstone(db_session, cred.organization_id)
        await _seed_tombstone(db_session, other_org)

        response = await async_client.get("/api/tombstones", headers=_daemon_headers(cred))
        assert response.status_code == status.HTTP_200_OK

        returned_ids = {t["id"] for t in response.json()["tombstones"]}
        assert own_t.id in returned_ids

        # Count must not include the other-org tombstone
        assert len(returned_ids) == 1

    @pytest.mark.asyncio
    async def test_empty_result_for_org_with_no_tombstones(
        self, async_client, daemon_credential
    ):
        cred, _ = daemon_credential
        response = await async_client.get("/api/tombstones", headers=_daemon_headers(cred))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["tombstones"] == []
        assert data["next_since"] is None

    def test_requires_daemon_auth(self, client):
        response = client.get("/api/tombstones")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# Cursor pagination
# =============================================================================

class TestTombstonesPagination:
    """issued_at ascending cursor pagination."""

    @pytest_asyncio.fixture
    async def five_tombstones(self, db_session, daemon_credential):
        cred, _ = daemon_credential
        org_id = cred.organization_id
        tombstones = []
        for i in range(5):
            t = await _seed_tombstone(db_session, org_id, offset_seconds=i * 10)
            tombstones.append(t)
        return cred, tombstones

    @pytest.mark.asyncio
    async def test_limit_respected(self, async_client, five_tombstones):
        cred, _ = five_tombstones
        response = await async_client.get(
            "/api/tombstones?limit=3", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["tombstones"]) == 3

    @pytest.mark.asyncio
    async def test_cursor_returns_next_page(self, async_client, five_tombstones):
        cred, tombstones = five_tombstones
        p1 = await async_client.get(
            "/api/tombstones?limit=2", headers=_daemon_headers(cred)
        )
        assert p1.status_code == status.HTTP_200_OK
        d1 = p1.json()
        next_since = d1["next_since"]
        assert next_since is not None

        p2 = await async_client.get(
            f"/api/tombstones?limit=2&since={next_since}",
            headers=_daemon_headers(cred),
        )
        assert p2.status_code == status.HTTP_200_OK
        d2 = p2.json()
        assert len(d2["tombstones"]) >= 1

        ids_p1 = {t["id"] for t in d1["tombstones"]}
        ids_p2 = {t["id"] for t in d2["tombstones"]}
        # Must contain new tombstones
        assert len(ids_p2 - ids_p1) >= 1

    @pytest.mark.asyncio
    async def test_ascending_order_by_issued_at(self, async_client, five_tombstones):
        cred, tombstones = five_tombstones
        response = await async_client.get(
            "/api/tombstones?limit=5", headers=_daemon_headers(cred)
        )
        assert response.status_code == status.HTTP_200_OK
        rows = response.json()["tombstones"]
        # issued_at must be in ascending order
        issued_ats = [r["issued_at"] for r in rows]
        assert issued_ats == sorted(issued_ats)

    @pytest.mark.asyncio
    async def test_full_page_has_next_since(self, async_client, five_tombstones):
        cred, _ = five_tombstones
        response = await async_client.get(
            "/api/tombstones?limit=3", headers=_daemon_headers(cred)
        )
        assert response.json()["next_since"] is not None

    @pytest.mark.asyncio
    async def test_partial_page_has_no_next_since(self, async_client, five_tombstones):
        cred, _ = five_tombstones
        response = await async_client.get(
            "/api/tombstones?limit=1000", headers=_daemon_headers(cred)
        )
        assert response.json()["next_since"] is None


# =============================================================================
# Tombstone fields
# =============================================================================

class TestTombstoneFields:
    """Verify field values returned in the response."""

    @pytest.mark.asyncio
    async def test_signal_tombstone_has_correct_fields(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        signal_id = str(uuid4())
        t = SignalTombstone(
            id=str(uuid4()),
            organization_id=cred.organization_id,
            tombstone_type="signal",
            signal_id=signal_id,
            issued_at=datetime.utcnow(),
        )
        db_session.add(t)
        await db_session.flush()

        response = await async_client.get("/api/tombstones", headers=_daemon_headers(cred))
        assert response.status_code == status.HTTP_200_OK
        rows = response.json()["tombstones"]
        assert len(rows) == 1
        row = rows[0]
        assert row["tombstone_type"] == "signal"
        assert row["signal_id"] == signal_id
        assert row["id"] == t.id

    @pytest.mark.asyncio
    async def test_email_hash_tombstone_has_correct_fields(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        test_hash = "a" * 64
        t = SignalTombstone(
            id=str(uuid4()),
            organization_id=cred.organization_id,
            tombstone_type="email_hash",
            email_hash=test_hash,
            issued_at=datetime.utcnow(),
        )
        db_session.add(t)
        await db_session.flush()

        response = await async_client.get("/api/tombstones", headers=_daemon_headers(cred))
        assert response.status_code == status.HTTP_200_OK
        rows = response.json()["tombstones"]
        row = next(r for r in rows if r["tombstone_type"] == "email_hash")
        assert row["email_hash"] == test_hash
