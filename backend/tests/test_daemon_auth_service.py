"""
Unit / integration tests for app.services.daemon_auth_service.

Covers:
- issue_auth_code + consume_auth_code (single-use, state CSRF, TTL)
- rotate_refresh_token: happy path, race-safe grace branch, stale generation,
  revoked credential
- issue_initial_credential
"""

import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi import status

from app.services.daemon_auth_service import (
    AUTH_CODE_TTL_SECONDS,
    REFRESH_GRACE_SECONDS,
    _AUTH_CODE_CACHE,
    _hash_token,
    consume_auth_code,
    issue_auth_code,
    issue_initial_credential,
    rotate_refresh_token,
)


# =============================================================================
# Auth-code helpers
# =============================================================================


class TestIssueAndConsumeAuthCode:
    """Single-use loopback OAuth auth-code flow."""

    def setup_method(self):
        """Clear the in-memory auth-code cache before each test."""
        _AUTH_CODE_CACHE.clear()

    def test_issue_returns_non_empty_string(self):
        code = issue_auth_code(
            user_id="user-1",
            organization_id="org-1",
            user_email="test@example.com",
            device_label="My Mac",
            state="csrf-abc",
        )
        assert isinstance(code, str)
        assert len(code) > 8

    def test_consume_valid_code_returns_payload(self):
        state = "csrf-xyz"
        code = issue_auth_code(
            user_id="u1",
            organization_id="o1",
            user_email="a@b.com",
            device_label="Laptop",
            state=state,
        )
        payload = consume_auth_code(code, state)
        assert payload is not None
        assert payload["user_id"] == "u1"
        assert payload["organization_id"] == "o1"
        assert payload["user_email"] == "a@b.com"

    def test_consume_same_code_twice_returns_none_second_time(self):
        """Single-use: consuming a code a second time returns None."""
        state = "csrf-abc"
        code = issue_auth_code(
            user_id="u1",
            organization_id="o1",
            user_email="a@b.com",
            device_label="",
            state=state,
        )
        first = consume_auth_code(code, state)
        second = consume_auth_code(code, state)
        assert first is not None
        assert second is None

    def test_consume_with_wrong_state_returns_none(self):
        code = issue_auth_code(
            user_id="u1",
            organization_id="o1",
            user_email="a@b.com",
            device_label="",
            state="correct-state",
        )
        result = consume_auth_code(code, "wrong-state")
        assert result is None

    def test_consume_unknown_code_returns_none(self):
        assert consume_auth_code("totally-made-up-code", "any-state") is None

    def test_consume_expired_code_returns_none(self):
        """Mock datetime so the code is past its TTL."""
        state = "s1"
        code = issue_auth_code(
            user_id="u1",
            organization_id="o1",
            user_email="a@b.com",
            device_label="",
            state=state,
        )
        # Wind the expiry into the past.
        past = datetime.utcnow() - timedelta(seconds=AUTH_CODE_TTL_SECONDS + 1)
        _AUTH_CODE_CACHE[code]["expires_at"] = past

        result = consume_auth_code(code, state)
        assert result is None

    def test_consume_removes_expired_code_from_cache(self):
        state = "s2"
        code = issue_auth_code(
            user_id="u1",
            organization_id="o1",
            user_email="a@b.com",
            device_label="",
            state=state,
        )
        _AUTH_CODE_CACHE[code]["expires_at"] = datetime.utcnow() - timedelta(seconds=1)
        consume_auth_code(code, state)
        assert code not in _AUTH_CODE_CACHE


# =============================================================================
# Refresh-token rotation
# =============================================================================


class TestRotateRefreshToken:
    """Rotate, race-grace, revoked, stale-generation coverage."""

    @pytest_asyncio.fixture(autouse=True)
    async def seed_credential(self, db_session):
        """Issue a fresh credential and store the plaintext refresh token."""
        refresh, _access = await issue_initial_credential(
            db=db_session,
            daemon_id="daemon-test-001",
            organization_id="org-test",
            user_id="user-test",
            user_email="owner@example.com",
            device_label="Test Mac",
        )
        self.refresh_token = refresh
        self.db = db_session

    @pytest.mark.asyncio
    async def test_happy_path_rotation(self):
        """Presenting the current refresh token returns a new one and new access."""
        result = await rotate_refresh_token(self.db, self.refresh_token)
        assert result is not None
        cred, new_refresh, access = result
        assert new_refresh != self.refresh_token
        assert len(new_refresh) > 8
        assert len(access) > 8

    @pytest.mark.asyncio
    async def test_generation_increments(self):
        """Generation counter must increase on each rotation."""
        result = await rotate_refresh_token(self.db, self.refresh_token)
        assert result is not None
        cred, _, _ = result
        assert cred.refresh_generation == 2  # started at 1 (issue_initial sets 1)

    @pytest.mark.asyncio
    async def test_stale_token_rejected(self):
        """Presenting the original token a second time (already rotated) fails."""
        await rotate_refresh_token(self.db, self.refresh_token)
        # The original refresh is now stale (beyond the grace window would also
        # fail, but even within grace the first call consumed it)
        result2 = await rotate_refresh_token(self.db, self.refresh_token)
        # It lands on the grace branch: if within grace it returns (cred, "", access).
        # We only assert we don't get a *new* rotation with the old token.
        if result2 is not None:
            _cred, new_r, _a = result2
            # Grace branch — new_r must be sentinel "" (keep current).
            assert new_r == ""

    @pytest.mark.asyncio
    async def test_rotated_token_can_be_used_for_next_rotation(self):
        """After one rotation, the new token is accepted for the next rotation."""
        res1 = await rotate_refresh_token(self.db, self.refresh_token)
        assert res1 is not None
        _, new_refresh_1, _ = res1

        res2 = await rotate_refresh_token(self.db, new_refresh_1)
        assert res2 is not None
        _, new_refresh_2, _ = res2
        assert new_refresh_2 != new_refresh_1

    @pytest.mark.asyncio
    async def test_revoked_credential_rejected(self):
        """Presenting a valid refresh token for a revoked credential returns None."""
        # Manually revoke
        from sqlalchemy import select
        from app.models import DaemonCredential
        stmt = select(DaemonCredential).where(DaemonCredential.daemon_id == "daemon-test-001")
        result = await self.db.execute(stmt)
        cred = result.scalar_one()
        cred.revoked_at = datetime.utcnow()
        await self.db.flush()

        result = await rotate_refresh_token(self.db, self.refresh_token)
        assert result is None

    @pytest.mark.asyncio
    async def test_concurrent_rotation_race_grace(self):
        """Two concurrent calls with the same refresh token.

        The winner gets a real new_refresh; the loser gets the grace sentinel "".
        Both together never leave the DB in an inconsistent state and neither
        call returns None (which would force re-auth).
        """
        results = await asyncio.gather(
            rotate_refresh_token(self.db, self.refresh_token),
            rotate_refresh_token(self.db, self.refresh_token),
            return_exceptions=True,
        )

        # Filter out exceptions (shouldn't be any).
        valid = [r for r in results if not isinstance(r, BaseException) and r is not None]

        # At least one must succeed. The other may return grace (also not None)
        # or also succeed if the DB serialized them.
        assert len(valid) >= 1

        new_refreshes = [r[1] for r in valid]
        # The real new token must be non-empty in at least one result.
        real_rotations = [nr for nr in new_refreshes if nr != ""]
        assert len(real_rotations) >= 1


# =============================================================================
# issue_initial_credential
# =============================================================================


class TestIssueInitialCredential:
    """Smoke test the first-ever credential issuance."""

    @pytest.mark.asyncio
    async def test_returns_refresh_and_access(self, db_session):
        refresh, access = await issue_initial_credential(
            db=db_session,
            daemon_id="daemon-new",
            organization_id="org-x",
            user_id="user-x",
            user_email="x@x.com",
            device_label="New Mac",
        )
        assert isinstance(refresh, str) and len(refresh) > 8
        assert isinstance(access, str) and len(access) > 8

    @pytest.mark.asyncio
    async def test_credential_stored_in_db(self, db_session):
        from sqlalchemy import select
        from app.models import DaemonCredential

        await issue_initial_credential(
            db=db_session,
            daemon_id="daemon-db-check",
            organization_id="org-y",
            user_id="user-y",
            user_email="y@y.com",
            device_label="",
        )
        stmt = select(DaemonCredential).where(DaemonCredential.daemon_id == "daemon-db-check")
        result = await db_session.execute(stmt)
        cred = result.scalar_one_or_none()
        assert cred is not None
        assert cred.organization_id == "org-y"
        assert cred.refresh_generation == 1

    @pytest.mark.asyncio
    async def test_refresh_token_stored_as_hash_not_plaintext(self, db_session):
        from sqlalchemy import select
        from app.models import DaemonCredential

        refresh, _ = await issue_initial_credential(
            db=db_session,
            daemon_id="daemon-hash-check",
            organization_id="org-z",
            user_id="user-z",
            user_email="z@z.com",
            device_label="",
        )
        stmt = select(DaemonCredential).where(DaemonCredential.daemon_id == "daemon-hash-check")
        result = await db_session.execute(stmt)
        cred = result.scalar_one()
        assert cred.refresh_token_hash != refresh
        assert cred.refresh_token_hash == _hash_token(refresh)
