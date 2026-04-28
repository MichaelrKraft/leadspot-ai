"""
Integration tests for app/routers/admin_purge.py.

POST /admin/purge

Covers:
- Non-admin user gets 403.
- Admin user with valid email_hash soft-deletes all matching signals and
  inserts a tombstone of type 'email_hash'.
- Idempotency: calling twice doesn't double-tombstone (idempotent purge count).
- Org-scope: signals from another org are not affected.
- Response fields: purged_count, tombstone_id.
"""

from datetime import datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy import select

from app.models import Contact, EmailAlias, Signal, SignalTombstone, User
from app.utils.email_normalize import email_hash


# =============================================================================
# Helpers
# =============================================================================

VALID_HASH = "a" * 64  # 64-char hex-looking string


def _admin_headers(org_id: str, user_id: str, email: str = "admin@test.com") -> dict:
    from uuid import UUID
    from app.services.auth_service import create_access_token
    token = create_access_token(
        user_id=UUID(user_id),
        email=email,
        organization_id=UUID(org_id),
        role="admin",
    )
    return {"Authorization": f"Bearer {token}"}


def _user_headers(org_id: str, user_id: str) -> dict:
    from uuid import UUID
    from app.services.auth_service import create_access_token
    token = create_access_token(
        user_id=UUID(user_id),
        email="user@test.com",
        organization_id=UUID(org_id),
        role="user",
    )
    return {"Authorization": f"Bearer {token}"}


async def _seed_admin_user(db_session, org_id: str) -> User:
    from app.services.auth_service import hash_password
    user = User(
        user_id=str(uuid4()),
        email="admin@purgetest.com",
        hashed_password=hash_password("AdminPw123!"),
        name="Admin",
        organization_id=org_id,
        role="admin",
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_regular_user(db_session, org_id: str) -> User:
    from app.services.auth_service import hash_password
    user = User(
        user_id=str(uuid4()),
        email="regular@purgetest.com",
        hashed_password=hash_password("UserPw123!"),
        name="Regular",
        organization_id=org_id,
        role="user",
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_signal(
    db_session,
    org_id: str,
    contact_match_key: str,
    contact_id: str = None,
) -> Signal:
    s = Signal(
        id=str(uuid4()),
        idempotency_key=str(uuid4())[:64],
        contact_id=contact_id,
        contact_match_key=contact_match_key,
        organization_id=org_id,
        source="ambient_screen",
        extractor="explicit_email",
        summary="test",
        confidence=90,
        state="promoted",
        redaction_status="clean",
        observed_at=datetime.utcnow(),
        daemon_id=str(uuid4()),
        schema_version=1,
    )
    db_session.add(s)
    await db_session.flush()
    return s


# =============================================================================
# Authorization
# =============================================================================

class TestAdminPurgeAuthorization:
    """Only admin/superadmin users may call POST /admin/purge."""

    @pytest.mark.asyncio
    async def test_non_admin_user_gets_403(self, async_client, db_session):
        org_id = str(uuid4())
        user = await _seed_regular_user(db_session, org_id)
        headers = _user_headers(org_id, user.user_id)

        response = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_request_rejected(self, client):
        response = client.post("/admin/purge", json={"email_hash": VALID_HASH})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# Purge behavior
# =============================================================================

class TestAdminPurgeBehavior:
    """Functional behavior of the purge endpoint."""

    @pytest_asyncio.fixture
    async def org_and_admin(self, db_session):
        org_id = str(uuid4())
        admin = await _seed_admin_user(db_session, org_id)
        return org_id, admin

    @pytest.mark.asyncio
    async def test_purge_returns_purged_count_and_tombstone_id(
        self, async_client, db_session, org_and_admin
    ):
        org_id, admin = org_and_admin
        await _seed_signal(db_session, org_id, VALID_HASH)

        headers = _admin_headers(org_id, admin.user_id, admin.email)
        response = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "purged_count" in data
        assert "tombstone_id" in data
        assert data["purged_count"] >= 1

    @pytest.mark.asyncio
    async def test_purge_soft_deletes_signals_by_contact_match_key(
        self, async_client, db_session, org_and_admin
    ):
        org_id, admin = org_and_admin
        signal = await _seed_signal(db_session, org_id, VALID_HASH)

        headers = _admin_headers(org_id, admin.user_id, admin.email)
        await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )

        await db_session.refresh(signal)
        assert signal.deleted_at is not None

    @pytest.mark.asyncio
    async def test_purge_inserts_tombstone_of_type_email_hash(
        self, async_client, db_session, org_and_admin
    ):
        org_id, admin = org_and_admin

        headers = _admin_headers(org_id, admin.user_id, admin.email)
        response = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )
        tombstone_id = response.json()["tombstone_id"]

        stmt = select(SignalTombstone).where(SignalTombstone.id == tombstone_id)
        result = await db_session.execute(stmt)
        tombstone = result.scalar_one_or_none()
        assert tombstone is not None
        assert tombstone.tombstone_type == "email_hash"
        assert tombstone.email_hash == VALID_HASH

    @pytest.mark.asyncio
    async def test_purge_idempotent_does_not_double_soft_delete(
        self, async_client, db_session, org_and_admin
    ):
        """Calling purge twice: second call returns purged_count=0 (already deleted)."""
        org_id, admin = org_and_admin
        await _seed_signal(db_session, org_id, VALID_HASH)

        headers = _admin_headers(org_id, admin.user_id, admin.email)
        r1 = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )
        r2 = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )
        assert r1.status_code == status.HTTP_200_OK
        assert r2.status_code == status.HTTP_200_OK
        # Second call should purge 0 additional signals
        assert r2.json()["purged_count"] == 0

    @pytest.mark.asyncio
    async def test_purge_via_email_alias_contact_id(
        self, async_client, db_session, org_and_admin
    ):
        """Signals attached to a contact whose alias matches are also purged."""
        org_id, admin = org_and_admin
        contact_id = str(uuid4())

        # Seed an EmailAlias linking the hash to a contact_id
        alias = EmailAlias(
            id=str(uuid4()),
            contact_id=contact_id,
            organization_id=org_id,
            email_hash=VALID_HASH,
            email_display="test@example.com",
            is_primary=True,
        )
        db_session.add(alias)

        # Seed a signal with contact_id (not contact_match_key)
        signal = Signal(
            id=str(uuid4()),
            idempotency_key=str(uuid4())[:64],
            contact_id=contact_id,
            contact_match_key="something-else",
            organization_id=org_id,
            source="ambient_screen",
            extractor="explicit_email",
            summary="test",
            confidence=90,
            state="promoted",
            redaction_status="clean",
            observed_at=datetime.utcnow(),
            daemon_id=str(uuid4()),
            schema_version=1,
        )
        db_session.add(signal)
        await db_session.flush()

        headers = _admin_headers(org_id, admin.user_id, admin.email)
        response = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["purged_count"] >= 1

        await db_session.refresh(signal)
        assert signal.deleted_at is not None

    @pytest.mark.asyncio
    async def test_purge_does_not_affect_other_org_signals(
        self, async_client, db_session, org_and_admin
    ):
        """Signals in other orgs sharing the same email_hash must NOT be purged."""
        org_id, admin = org_and_admin
        other_org = str(uuid4())

        other_signal = await _seed_signal(db_session, other_org, VALID_HASH)

        headers = _admin_headers(org_id, admin.user_id, admin.email)
        await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH},
            headers=headers,
        )

        await db_session.refresh(other_signal)
        assert other_signal.deleted_at is None

    @pytest.mark.asyncio
    async def test_purge_email_hash_must_be_64_chars(
        self, async_client, db_session, org_and_admin
    ):
        """The schema enforces 64-char email_hash; shorter values get 422."""
        org_id, admin = org_and_admin
        headers = _admin_headers(org_id, admin.user_id, admin.email)
        response = await async_client.post(
            "/admin/purge",
            json={"email_hash": "tooshort"},
            headers=headers,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_purge_reason_stored_on_tombstone(
        self, async_client, db_session, org_and_admin
    ):
        org_id, admin = org_and_admin
        headers = _admin_headers(org_id, admin.user_id, admin.email)
        reason = "GDPR deletion request #42"
        response = await async_client.post(
            "/admin/purge",
            json={"email_hash": VALID_HASH, "reason": reason},
            headers=headers,
        )
        assert response.status_code == status.HTTP_200_OK
        tombstone_id = response.json()["tombstone_id"]
        stmt = select(SignalTombstone).where(SignalTombstone.id == tombstone_id)
        result = await db_session.execute(stmt)
        tombstone = result.scalar_one()
        assert tombstone.reason == reason
