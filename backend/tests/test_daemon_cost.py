"""
Integration tests for app/routers/daemon_cost.py.

POST /api/daemon/cost/increment

Covers:
- Under-cap request returns cost_capped=False.
- Over-cap request (LEADSPOT_HAIKU_DAILY_TOKEN_CAP env var) returns cost_capped=True.
- Upsert: second call accumulates tokens on the same row.
- Two different daemons for the same user maintain separate rows (cap math note).
- Invalid auth rejected with 401.
"""

import os
from datetime import date, datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy import select
from unittest.mock import patch

from app.models import DaemonCredential, DaemonTokenUsage
from app.services.daemon_auth_service import (
    create_daemon_access_token,
    issue_initial_credential,
)


# =============================================================================
# Helpers
# =============================================================================

def _daemon_headers(cred) -> dict:
    token = create_daemon_access_token(
        daemon_id=cred.daemon_id,
        organization_id=cred.organization_id,
        user_id=cred.user_id,
    )
    return {"Authorization": f"Bearer {token}"}


def _increment_body(**overrides) -> dict:
    return {
        "haiku_tokens_input": 100,
        "haiku_tokens_output": 50,
        "sonnet_tokens_input": 0,
        "sonnet_tokens_output": 0,
        "signal_count": 1,
        **overrides,
    }


# =============================================================================
# Happy path
# =============================================================================

class TestDaemonCostIncrement:
    """POST /api/daemon/cost/increment."""

    def test_happy_path_returns_200_and_not_capped(self, client, daemon_auth_headers, daemon_credential):
        response = client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(),
            headers=daemon_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["cost_capped"] is False
        assert data["haiku_tokens_today"] == 150  # 100 input + 50 output
        assert data["cap"] > 0

    def test_unauthenticated_request_rejected(self, client):
        response = client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(),
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_second_call_accumulates_tokens(self, client, daemon_auth_headers, daemon_credential):
        """Two calls on the same day should accumulate, not overwrite."""
        client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(haiku_tokens_input=300, haiku_tokens_output=100),
            headers=daemon_auth_headers,
        )
        r2 = client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(haiku_tokens_input=200, haiku_tokens_output=100),
            headers=daemon_auth_headers,
        )
        assert r2.status_code == status.HTTP_200_OK
        # 300+100 + 200+100 = 700 total
        assert r2.json()["haiku_tokens_today"] == 700

    @pytest.mark.asyncio
    async def test_db_row_created_after_increment(
        self, async_client, db_session, daemon_credential
    ):
        cred, _ = daemon_credential
        headers = _daemon_headers(cred)

        await async_client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(),
            headers=headers,
        )

        stmt = select(DaemonTokenUsage).where(
            DaemonTokenUsage.daemon_id == cred.daemon_id
        )
        result = await db_session.execute(stmt)
        row = result.scalar_one_or_none()
        assert row is not None
        assert row.haiku_tokens_input == 100
        assert row.haiku_tokens_output == 50


# =============================================================================
# Cap enforcement
# =============================================================================

class TestDaemonCostCap:
    """LEADSPOT_HAIKU_DAILY_TOKEN_CAP enforcement."""

    def test_under_cap_not_capped(self, client, daemon_auth_headers):
        with patch.dict(os.environ, {"LEADSPOT_HAIKU_DAILY_TOKEN_CAP": "1000"}):
            response = client.post(
                "/api/daemon/cost/increment",
                json=_increment_body(haiku_tokens_input=400, haiku_tokens_output=100),
                headers=daemon_auth_headers,
            )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["cost_capped"] is False
        assert response.json()["cap"] == 1000

    def test_at_cap_is_capped(self, client, daemon_auth_headers):
        with patch.dict(os.environ, {"LEADSPOT_HAIKU_DAILY_TOKEN_CAP": "1000"}):
            response = client.post(
                "/api/daemon/cost/increment",
                json=_increment_body(haiku_tokens_input=700, haiku_tokens_output=300),
                headers=daemon_auth_headers,
            )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["cost_capped"] is True

    def test_over_cap_after_accumulation(self, client, daemon_auth_headers):
        """Send tokens under cap first, then push over the cap."""
        with patch.dict(os.environ, {"LEADSPOT_HAIKU_DAILY_TOKEN_CAP": "1000"}):
            client.post(
                "/api/daemon/cost/increment",
                json=_increment_body(haiku_tokens_input=400, haiku_tokens_output=100),
                headers=daemon_auth_headers,
            )
            r2 = client.post(
                "/api/daemon/cost/increment",
                json=_increment_body(haiku_tokens_input=400, haiku_tokens_output=200),
                headers=daemon_auth_headers,
            )
        assert r2.json()["cost_capped"] is True
        assert r2.json()["haiku_tokens_today"] == 1100

    def test_env_cap_1500_tokens_not_capped(self, client, daemon_auth_headers):
        """With env-override cap of 1500, sending 1000 tokens is not capped."""
        with patch.dict(os.environ, {"LEADSPOT_HAIKU_DAILY_TOKEN_CAP": "1500"}):
            response = client.post(
                "/api/daemon/cost/increment",
                json=_increment_body(haiku_tokens_input=900, haiku_tokens_output=100),
                headers=daemon_auth_headers,
            )
        assert response.json()["cost_capped"] is False


# =============================================================================
# Two daemons, same user
# =============================================================================

class TestTwoDaemonsSameUser:
    """Two daemons for the same user share a per-USER daily cap (plan §15).

    Each daemon writes its own row in `daemon_token_usage` (separate by
    daemon_id), but `haiku_tokens_today` returned by the endpoint is the
    SUM across all the user's daemons for the day.
    """

    @pytest_asyncio.fixture
    async def two_daemon_creds(self, db_session):
        """Two daemon credentials for the same user in the same org."""
        org_id = str(uuid4())
        user_id = str(uuid4())

        refresh1, _ = await issue_initial_credential(
            db=db_session,
            daemon_id=str(uuid4()),
            organization_id=org_id,
            user_id=user_id,
            user_email="user@example.com",
            device_label="Work Mac",
        )
        refresh2, _ = await issue_initial_credential(
            db=db_session,
            daemon_id=str(uuid4()),
            organization_id=org_id,
            user_id=user_id,
            user_email="user@example.com",
            device_label="Home Mac",
        )
        await db_session.flush()

        stmt = select(DaemonCredential).where(
            DaemonCredential.organization_id == org_id
        )
        result = await db_session.execute(stmt)
        creds = result.scalars().all()
        return creds[0], creds[1]

    def test_two_daemons_share_per_user_total(self, client, two_daemon_creds):
        cred1, cred2 = two_daemon_creds
        headers1 = _daemon_headers(cred1)
        headers2 = _daemon_headers(cred2)

        # Use explicit zero output so haiku_tokens_today = input only
        r1 = client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(haiku_tokens_input=100, haiku_tokens_output=0),
            headers=headers1,
        )
        r2 = client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(haiku_tokens_input=200, haiku_tokens_output=0),
            headers=headers2,
        )
        assert r1.status_code == status.HTTP_200_OK
        assert r2.status_code == status.HTTP_200_OK
        # Per-user cap: the second daemon's response sees the FIRST daemon's
        # 100 tokens too (100 + 200 = 300). The first daemon's response was
        # made before the second wrote, so it sees 100.
        assert r1.json()["haiku_tokens_today"] == 100
        assert r2.json()["haiku_tokens_today"] == 300

    @pytest.mark.asyncio
    async def test_two_daemons_each_have_their_own_db_row(
        self, async_client, db_session, two_daemon_creds
    ):
        """Storage is per-(user, daemon, day) — separate rows per Mac.
        The CAP MATH is per-user (sum across all daemons), but the rows
        themselves are still daemon-scoped so we can attribute usage by Mac
        in the admin cost dashboard (plan §13.4).
        """
        cred1, cred2 = two_daemon_creds
        headers1 = _daemon_headers(cred1)
        headers2 = _daemon_headers(cred2)

        await async_client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(haiku_tokens_input=500),
            headers=headers1,
        )
        await async_client.post(
            "/api/daemon/cost/increment",
            json=_increment_body(haiku_tokens_input=600),
            headers=headers2,
        )

        stmt = select(DaemonTokenUsage).where(
            DaemonTokenUsage.user_id == cred1.user_id
        )
        result = await db_session.execute(stmt)
        rows = result.scalars().all()

        # There should be 2 separate rows (one per daemon_id)
        assert len(rows) == 2
        daemon_ids = {r.daemon_id for r in rows}
        assert cred1.daemon_id in daemon_ids
        assert cred2.daemon_id in daemon_ids


# =============================================================================
# Edge cases
# =============================================================================

class TestDaemonCostEdgeCases:
    """Edge cases for the cost increment endpoint."""

    def test_zero_tokens_increments_do_not_cap(self, client, daemon_auth_headers):
        """Posting all-zero increments should never trigger the cap."""
        with patch.dict(os.environ, {"LEADSPOT_HAIKU_DAILY_TOKEN_CAP": "1000"}):
            for _ in range(5):
                r = client.post(
                    "/api/daemon/cost/increment",
                    json=_increment_body(
                        haiku_tokens_input=0,
                        haiku_tokens_output=0,
                        sonnet_tokens_input=0,
                        sonnet_tokens_output=0,
                    ),
                    headers=daemon_auth_headers,
                )
                assert r.json()["cost_capped"] is False

    def test_explicit_day_parameter_accepted(self, client, daemon_auth_headers):
        """Supplying an explicit day (backfill scenario) must be accepted."""
        response = client.post(
            "/api/daemon/cost/increment",
            json={**_increment_body(), "day": "2026-01-15"},
            headers=daemon_auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK

    def test_sonnet_tokens_tracked_but_not_in_haiku_cap(self, client, daemon_auth_headers):
        """Sonnet tokens are stored but do NOT count toward the Haiku cap."""
        with patch.dict(os.environ, {"LEADSPOT_HAIKU_DAILY_TOKEN_CAP": "1000"}):
            response = client.post(
                "/api/daemon/cost/increment",
                json=_increment_body(
                    haiku_tokens_input=0,
                    haiku_tokens_output=0,
                    sonnet_tokens_input=5000,
                    sonnet_tokens_output=5000,
                ),
                headers=daemon_auth_headers,
            )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # haiku_tokens_today = 0 (only haiku counts toward the cap)
        assert data["haiku_tokens_today"] == 0
        assert data["cost_capped"] is False
