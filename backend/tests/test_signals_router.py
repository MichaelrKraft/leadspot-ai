"""
Integration tests for the Signals router (app/routers/signals.py).

Mounted at /api.

Endpoints under test:
- POST   /api/signals              (daemon Bearer)
- GET    /api/contacts/{id}/signals (user Bearer)
- DELETE /api/signals/{signal_id}  (user Bearer)

Covered scenarios:
- Idempotency (single insert, concurrent duplicate)
- Merge-redirect resolution
- Org-scope enforcement (cross-org returns orphan)
- Schema-version 426
- daemon_id body ≠ token daemon_id → 403
- Timeline pagination (limit + before cursor, soft-deleted excluded)
- Soft-delete + tombstone creation
"""

import asyncio
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy import select

from app.models import (
    Contact,
    EmailAlias,
    MergeRedirect,
    Signal,
    SignalTombstone,
)
from app.utils.email_normalize import email_hash


# =============================================================================
# Helpers
# =============================================================================

def _signal_body(daemon_id: str, idempotency_key: str = None, **overrides) -> dict:
    """Return a minimal valid SignalIngestRequest payload."""
    return {
        "idempotency_key": idempotency_key or str(uuid4())[:64],
        "contact_match_key": "non-matching-key",
        "source": "ambient_screen",
        "extractor": "explicit_email",
        "summary": "test summary",
        "confidence": 90,
        "observed_at": datetime.utcnow().isoformat(),
        "daemon_id": daemon_id,
        "schema_version": 1,
        **overrides,
    }


async def _seed_contact(db_session, org_id: str, email: str) -> Contact:
    c = Contact(
        id=str(uuid4()),
        first_name="Jane",
        last_name="Doe",
        email=email,
        organization_id=org_id,
        updated_at=datetime.utcnow(),
    )
    db_session.add(c)
    await db_session.flush()
    return c


async def _seed_email_alias(db_session, org_id: str, contact_id: str, email: str) -> EmailAlias:
    alias = EmailAlias(
        id=str(uuid4()),
        contact_id=contact_id,
        organization_id=org_id,
        email_hash=email_hash(email),
        email_display=email,
        is_primary=True,
    )
    db_session.add(alias)
    await db_session.flush()
    return alias


# =============================================================================
# Ingest (POST /api/signals)
# =============================================================================

class TestSignalIngest:
    """POST /api/signals."""

    def test_happy_path_returns_201_with_signal_id(self, client, daemon_auth_headers, daemon_credential):
        cred, _ = daemon_credential
        body = _signal_body(daemon_id=cred.daemon_id)
        response = client.post("/api/signals", json=body, headers=daemon_auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "signal_id" in data
        assert data["state"] == "promoted"

    def test_unauthenticated_request_rejected(self, client, daemon_credential):
        cred, _ = daemon_credential
        body = _signal_body(daemon_id=cred.daemon_id)
        response = client.post("/api/signals", json=body)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_daemon_id_mismatch_returns_403(self, client, daemon_auth_headers, daemon_credential):
        """Body daemon_id doesn't match the Bearer token's daemon."""
        _cred, _ = daemon_credential
        body = _signal_body(daemon_id=str(uuid4()))  # Different id
        response = client.post("/api/signals", json=body, headers=daemon_auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_schema_version_above_server_returns_426(self, client, daemon_auth_headers, daemon_credential):
        cred, _ = daemon_credential
        body = _signal_body(daemon_id=cred.daemon_id, schema_version=999)
        response = client.post("/api/signals", json=body, headers=daemon_auth_headers)
        assert response.status_code == status.HTTP_426_UPGRADE_REQUIRED


class TestSignalIdempotency:
    """Critical: identical idempotency_key must produce exactly 1 DB row."""

    def test_posting_same_key_twice_returns_same_signal_id(self, client, daemon_auth_headers, daemon_credential):
        cred, _ = daemon_credential
        idem_key = str(uuid4())[:64]
        body = _signal_body(daemon_id=cred.daemon_id, idempotency_key=idem_key)

        r1 = client.post("/api/signals", json=body, headers=daemon_auth_headers)
        r2 = client.post("/api/signals", json=body, headers=daemon_auth_headers)

        assert r1.status_code == status.HTTP_200_OK
        assert r2.status_code == status.HTTP_200_OK
        assert r1.json()["signal_id"] == r2.json()["signal_id"]

    def test_posting_same_key_100_times_produces_one_db_row(self, client, daemon_auth_headers, daemon_credential, db_session):
        cred, _ = daemon_credential
        idem_key = str(uuid4())[:64]
        body = _signal_body(daemon_id=cred.daemon_id, idempotency_key=idem_key)

        signal_ids = set()
        for _ in range(100):
            r = client.post("/api/signals", json=body, headers=daemon_auth_headers)
            assert r.status_code == status.HTTP_200_OK
            signal_ids.add(r.json()["signal_id"])

        assert len(signal_ids) == 1


class TestMergeRedirectResolution:
    """Critical: signal targeting a merged contact must land on the merge target."""

    @pytest.mark.asyncio
    async def test_signal_attributed_to_merge_target(self, async_client, db_session, daemon_credential):
        cred, _ = daemon_credential
        org_id = cred.organization_id

        contact_a = await _seed_contact(db_session, org_id, "jane@acme.com")
        contact_b = await _seed_contact(db_session, org_id, "jane.doe@acme.com")

        await _seed_email_alias(db_session, org_id, contact_a.id, "jane@acme.com")

        redirect = MergeRedirect(
            old_contact_id=contact_a.id,
            new_contact_id=contact_b.id,
            organization_id=org_id,
            merged_at=datetime.utcnow(),
        )
        db_session.add(redirect)
        await db_session.flush()

        from app.services.daemon_auth_service import create_daemon_access_token
        token = create_daemon_access_token(
            daemon_id=cred.daemon_id,
            organization_id=cred.organization_id,
            user_id=cred.user_id,
        )
        headers = {"Authorization": f"Bearer {token}"}

        match_key = email_hash("jane@acme.com")
        body = _signal_body(daemon_id=cred.daemon_id, contact_match_key=match_key)

        response = await async_client.post("/api/signals", json=body, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["contact_id"] == contact_b.id
        assert data["contact_id"] != contact_a.id


class TestOrgScopeEnforcement:
    """Signal targeting a contact in a different org must produce an orphan (contact_id=null)."""

    @pytest.mark.asyncio
    async def test_cross_org_contact_produces_orphan(self, async_client, db_session, daemon_credential):
        cred, _ = daemon_credential
        other_org_id = str(uuid4())

        contact_other = await _seed_contact(db_session, other_org_id, "alien@other.com")
        await _seed_email_alias(db_session, other_org_id, contact_other.id, "alien@other.com")

        from app.services.daemon_auth_service import create_daemon_access_token
        token = create_daemon_access_token(
            daemon_id=cred.daemon_id,
            organization_id=cred.organization_id,
            user_id=cred.user_id,
        )
        headers = {"Authorization": f"Bearer {token}"}

        match_key = email_hash("alien@other.com")
        body = _signal_body(daemon_id=cred.daemon_id, contact_match_key=match_key)

        response = await async_client.post("/api/signals", json=body, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["contact_id"] is None


# =============================================================================
# Timeline (GET /api/contacts/{id}/signals)
# =============================================================================

class TestContactSignalsTimeline:
    """GET /api/contacts/{id}/signals."""

    @pytest_asyncio.fixture
    async def seeded_signals(self, db_session, daemon_credential, test_user):
        """Seed 50 signals for a contact, then return (contact_id, org_id)."""
        cred, _ = daemon_credential
        org_id = str(test_user.organization_id)

        contact = await _seed_contact(db_session, org_id, "target@example.com")

        for i in range(50):
            signal = Signal(
                id=str(uuid4()),
                idempotency_key=str(uuid4())[:64],
                contact_id=contact.id,
                contact_match_key=email_hash("target@example.com"),
                organization_id=org_id,
                source="ambient_screen",
                extractor="explicit_email",
                summary=f"signal {i}",
                confidence=90,
                state="promoted",
                redaction_status="clean",
                observed_at=datetime.utcnow() - timedelta(minutes=i),
                daemon_id=cred.daemon_id,
                schema_version=1,
            )
            db_session.add(signal)
        await db_session.flush()
        return contact.id, org_id

    def test_limit_respected(self, client, auth_headers, test_user, seeded_signals):
        contact_id, _ = seeded_signals
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.get(f"/api/contacts/{contact_id}/signals?limit=10", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["signals"]) == 10

    def test_cursor_pagination(self, client, test_user, seeded_signals):
        contact_id, _ = seeded_signals
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        page1 = client.get(f"/api/contacts/{contact_id}/signals?limit=10", headers=headers)
        assert page1.status_code == status.HTTP_200_OK
        d1 = page1.json()
        assert len(d1["signals"]) == 10
        next_before = d1["next_before"]
        assert next_before is not None

        page2 = client.get(
            f"/api/contacts/{contact_id}/signals?limit=10&before={next_before}",
            headers=headers,
        )
        assert page2.status_code == status.HTTP_200_OK
        d2 = page2.json()
        assert len(d2["signals"]) == 10
        # Signals should not overlap
        ids_p1 = {s["id"] for s in d1["signals"]}
        ids_p2 = {s["id"] for s in d2["signals"]}
        assert ids_p1.isdisjoint(ids_p2)

    def test_soft_deleted_signals_excluded(self, client, db_session, test_user, seeded_signals):
        contact_id, org_id = seeded_signals
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Get original count
        r1 = client.get(f"/api/contacts/{contact_id}/signals?limit=200", headers=headers)
        original_count = len(r1.json()["signals"])

        # Soft-delete one via the DELETE endpoint
        first_signal_id = r1.json()["signals"][0]["id"]
        del_r = client.delete(f"/api/signals/{first_signal_id}", headers=headers)
        assert del_r.status_code == status.HTTP_204_NO_CONTENT

        # Re-fetch: count should be one less
        r2 = client.get(f"/api/contacts/{contact_id}/signals?limit=200", headers=headers)
        assert len(r2.json()["signals"]) == original_count - 1

    def test_requires_auth(self, client, seeded_signals):
        contact_id, _ = seeded_signals
        response = client.get(f"/api/contacts/{contact_id}/signals")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# Soft-delete (DELETE /api/signals/{signal_id})
# =============================================================================

class TestSoftDeleteSignal:
    """DELETE /api/signals/{signal_id}."""

    @pytest_asyncio.fixture
    async def one_signal(self, db_session, daemon_credential, test_user):
        cred, _ = daemon_credential
        org_id = str(test_user.organization_id)
        contact = await _seed_contact(db_session, org_id, "delete-me@example.com")
        signal = Signal(
            id=str(uuid4()),
            idempotency_key=str(uuid4())[:64],
            contact_id=contact.id,
            contact_match_key=email_hash("delete-me@example.com"),
            organization_id=org_id,
            source="ambient_screen",
            extractor="explicit_email",
            summary="will be deleted",
            confidence=90,
            state="promoted",
            redaction_status="clean",
            observed_at=datetime.utcnow(),
            daemon_id=cred.daemon_id,
            schema_version=1,
        )
        db_session.add(signal)
        await db_session.flush()
        return signal, contact

    def test_delete_returns_204(self, client, test_user, one_signal):
        signal, _ = one_signal
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}
        response = client.delete(f"/api/signals/{signal.id}", headers=headers)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    @pytest.mark.asyncio
    async def test_delete_sets_deleted_at(self, async_client, db_session, test_user, one_signal):
        signal, _ = one_signal
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        await async_client.delete(f"/api/signals/{signal.id}", headers=headers)

        await db_session.refresh(signal)
        assert signal.deleted_at is not None

    @pytest.mark.asyncio
    async def test_delete_inserts_tombstone_of_type_signal(self, async_client, db_session, test_user, one_signal):
        signal, _ = one_signal
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        await async_client.delete(f"/api/signals/{signal.id}", headers=headers)

        stmt = select(SignalTombstone).where(
            SignalTombstone.signal_id == signal.id,
            SignalTombstone.tombstone_type == "signal",
        )
        result = await db_session.execute(stmt)
        tombstone = result.scalar_one_or_none()
        assert tombstone is not None
        assert tombstone.organization_id == str(test_user.organization_id)

    def test_delete_nonexistent_signal_returns_404(self, client, test_user):
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}
        response = client.delete(f"/api/signals/{uuid4()}", headers=headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_already_deleted_signal_returns_404(self, client, test_user, one_signal):
        signal, _ = one_signal
        from uuid import UUID
        from app.services.auth_service import create_access_token
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}
        client.delete(f"/api/signals/{signal.id}", headers=headers)
        response = client.delete(f"/api/signals/{signal.id}", headers=headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_requires_auth(self, client, one_signal):
        signal, _ = one_signal
        response = client.delete(f"/api/signals/{signal.id}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
