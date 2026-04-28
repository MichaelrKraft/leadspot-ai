"""Integration tests for app/routers/rtbf.py.

POST /api/contacts/forget — user-facing right-to-be-forgotten.

Scope test: a regular (non-admin) user can purge signals for a given email
WITHIN their own org, but signals in other orgs sharing the same email
must NOT be touched. A tombstone of type `email_hash` is recorded.
"""

from datetime import datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy import select

from app.models import Signal, SignalTombstone, User
from app.utils.email_normalize import email_hash as compute_email_hash


def _user_headers(org_id: str, user_id: str, email: str = "user@test.com") -> dict:
    from uuid import UUID

    from app.services.auth_service import create_access_token

    token = create_access_token(
        user_id=UUID(user_id),
        email=email,
        organization_id=UUID(org_id),
        role="user",
    )
    return {"Authorization": f"Bearer {token}"}


async def _seed_user(db_session, org_id: str) -> User:
    from app.services.auth_service import hash_password

    user = User(
        user_id=str(uuid4()),
        email=f"u-{uuid4().hex[:8]}@rtbftest.com",
        hashed_password=hash_password("UserPw123!"),
        name="Tester",
        organization_id=org_id,
        role="user",
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_signal_for_email(
    db_session,
    org_id: str,
    email: str,
) -> Signal:
    s = Signal(
        id=str(uuid4()),
        idempotency_key=str(uuid4())[:64],
        contact_id=None,
        contact_match_key=compute_email_hash(email),
        organization_id=org_id,
        source="ambient_screen",
        extractor="explicit_email",
        summary=f"saw {email}",
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


class TestUserForgetEndpoint:
    """Regular users may purge data within their own org."""

    @pytest.mark.asyncio
    async def test_forget_purges_only_within_user_org(
        self, async_client, db_session
    ):
        org_id = str(uuid4())
        other_org = str(uuid4())
        user = await _seed_user(db_session, org_id)

        # 3 signals in the user's org for evil@spam.com
        own_signals = [
            await _seed_signal_for_email(db_session, org_id, "evil@spam.com")
            for _ in range(3)
        ]
        # 2 signals in a DIFFERENT org for the same email
        other_signals = [
            await _seed_signal_for_email(db_session, other_org, "evil@spam.com")
            for _ in range(2)
        ]

        headers = _user_headers(org_id, user.user_id, user.email)
        response = await async_client.post(
            "/api/contacts/forget",
            json={"email": "evil@spam.com"},
            headers=headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["purged_count"] == 3
        assert "tombstone_id" in data
        assert data["email_hash"] == compute_email_hash("evil@spam.com")

        # Reload and check soft-deletion scope.
        for s in own_signals:
            await db_session.refresh(s)
            assert s.deleted_at is not None
        for s in other_signals:
            await db_session.refresh(s)
            assert s.deleted_at is None

        # Tombstone present and scoped to the user's org.
        ts_stmt = select(SignalTombstone).where(
            SignalTombstone.id == data["tombstone_id"]
        )
        ts_result = await db_session.execute(ts_stmt)
        tombstone = ts_result.scalar_one()
        assert tombstone.organization_id == org_id
        assert tombstone.tombstone_type == "email_hash"
        assert tombstone.email_hash == compute_email_hash("evil@spam.com")

    @pytest.mark.asyncio
    async def test_forget_requires_authentication(self, async_client):
        response = await async_client.post(
            "/api/contacts/forget",
            json={"email": "anyone@example.com"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_forget_rejects_invalid_email(self, async_client, db_session):
        org_id = str(uuid4())
        user = await _seed_user(db_session, org_id)
        headers = _user_headers(org_id, user.user_id, user.email)
        response = await async_client.post(
            "/api/contacts/forget",
            json={"email": "not-an-email"},
            headers=headers,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
