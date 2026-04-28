"""Tests for app/services/digest_service.py.

Covers the cold-start vs steady-state branch decision in
build_user_digest, plus the simple render path.
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio

from app.models import (
    Contact,
    DaemonCredential,
    DigestUnmatchedSample,
    Signal,
    User,
)
from app.services.digest_service import (
    build_user_digest,
    render_digest_email,
)


@pytest_asyncio.fixture
async def seeded_user(db_session) -> User:
    """A bare user with no daemon yet — implies cold-start mode."""
    org_id = str(uuid4())
    user = User(
        user_id=str(uuid4()),
        email="dogfood@example.com",
        name="Dogfood",
        organization_id=org_id,
        role="user",
        created_at=datetime.utcnow(),
        timezone="America/Los_Angeles",
    )
    db_session.add(user)
    await db_session.flush()
    return user


class TestBuildUserDigestModeBranch:
    """The decision the test plan calls out specifically: cold_start vs steady."""

    @pytest.mark.asyncio
    async def test_no_daemon_yet_returns_cold_start_mode(self, db_session, seeded_user):
        # No DaemonCredential rows at all → cold_start.
        payload = await build_user_digest(str(seeded_user.user_id), db_session)
        assert payload["mode"] == "cold_start"
        assert "cold_start" in payload["items"]

    @pytest.mark.asyncio
    async def test_recent_daemon_returns_cold_start_mode(self, db_session, seeded_user):
        # Daemon registered today → still in the 14-day cold-start window.
        cred = DaemonCredential(
            daemon_id=str(uuid4()),
            organization_id=str(seeded_user.organization_id),
            user_id=str(seeded_user.user_id),
            refresh_token_hash="x" * 64,
            refresh_generation=1,
            device_label="Test Mac",
            user_email_at_auth=seeded_user.email,
            created_at=datetime.utcnow(),
        )
        db_session.add(cred)
        await db_session.flush()

        payload = await build_user_digest(str(seeded_user.user_id), db_session)
        assert payload["mode"] == "cold_start"

    @pytest.mark.asyncio
    async def test_old_daemon_returns_steady_mode(self, db_session, seeded_user):
        # Daemon registered 30 days ago → past the 14-day cold-start window.
        cred = DaemonCredential(
            daemon_id=str(uuid4()),
            organization_id=str(seeded_user.organization_id),
            user_id=str(seeded_user.user_id),
            refresh_token_hash="x" * 64,
            refresh_generation=1,
            device_label="Old Mac",
            user_email_at_auth=seeded_user.email,
            created_at=datetime.utcnow() - timedelta(days=30),
        )
        db_session.add(cred)
        await db_session.flush()

        payload = await build_user_digest(str(seeded_user.user_id), db_session)
        assert payload["mode"] == "steady"
        # Steady-state has the two buckets, not cold_start.
        assert "stalled" in payload["items"]
        assert "hot" in payload["items"]
        assert "cold_start" not in payload["items"]

    @pytest.mark.asyncio
    async def test_cold_start_pulls_unmatched_samples(self, db_session, seeded_user):
        # Seed 2 unmatched samples for this org; cold_start should surface them.
        org_id = str(seeded_user.organization_id)
        now = datetime.utcnow()
        for i in range(2):
            db_session.add(
                DigestUnmatchedSample(
                    id=str(uuid4()),
                    daemon_id=str(uuid4()),
                    organization_id=org_id,
                    contact_match_key=f"hash{i}",
                    source_app="Gmail",
                    summary=f"sample {i}",
                    observed_at=now - timedelta(hours=i + 1),
                    expires_at=now + timedelta(days=10),
                    created_at=now,
                )
            )
        await db_session.flush()

        payload = await build_user_digest(str(seeded_user.user_id), db_session)
        assert payload["mode"] == "cold_start"
        items = payload["items"]["cold_start"]
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_steady_renders_without_signals(self, db_session, seeded_user):
        # Old daemon → steady mode; no signals → empty buckets but no crash.
        cred = DaemonCredential(
            daemon_id=str(uuid4()),
            organization_id=str(seeded_user.organization_id),
            user_id=str(seeded_user.user_id),
            refresh_token_hash="x" * 64,
            refresh_generation=1,
            device_label="Old Mac",
            user_email_at_auth=seeded_user.email,
            created_at=datetime.utcnow() - timedelta(days=30),
        )
        db_session.add(cred)
        await db_session.flush()

        payload = await build_user_digest(str(seeded_user.user_id), db_session)
        body = render_digest_email(payload)
        assert "Nothing pressing" in body or "leads" in body.lower()


class TestRenderDigestEmail:
    def test_render_cold_start_body_contains_email(self):
        payload = {
            "user_email": "dogfood@example.com",
            "user_id": "u1",
            "mode": "cold_start",
            "items": {"cold_start": []},
        }
        body = render_digest_email(payload)
        assert "dogfood@example.com" in body
        # Empty cold-start has the encouragement copy.
        assert "first day" in body or "send" in body.lower()

    def test_render_steady_body_contains_email(self):
        payload = {
            "user_email": "dogfood@example.com",
            "user_id": "u1",
            "mode": "steady",
            "items": {"stalled": [], "hot": []},
        }
        body = render_digest_email(payload)
        assert "dogfood@example.com" in body
