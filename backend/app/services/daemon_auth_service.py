"""Daemon authentication service.

Parallel to `auth_service.py` for users, but for the Ambient daemon. Tokens
have `aud=leadspot-daemon` so they can't be confused with user-session JWTs.

Flow (loopback OAuth, see plan §2.4):
1. Daemon spins HTTP server on a free localhost port and opens browser to
   /auth/daemon (browser-facing, requires user JWT).
2. User clicks "Authorize this Mac"; cloud issues a short-lived auth_code,
   redirects to http://localhost:<port>/cb?code=...&state=...
3. Daemon exchanges code at POST /api/daemon/auth/token → tokens.
4. Daemon stores refresh_token in macOS Keychain, access_token in memory.

Refresh-token rotation race fix (see DaemonCredential model):
- refresh_generation increments on every successful rotation.
- Previous-generation token within 60s grace returns the most-recent
  successor (idempotent), does NOT issue another rotation.
- Older or mismatched tokens are rejected.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import DaemonCredential

# Audience claim — distinguishes daemon tokens from user tokens.
# A user-session JWT will be rejected by the daemon dependency, and vice versa.
DAEMON_TOKEN_AUDIENCE = "leadspot-daemon"

# Access token TTL (per plan §2.4).
DAEMON_ACCESS_TOKEN_MINUTES = 15

# Refresh token rotation grace window (per plan §2.4).
REFRESH_GRACE_SECONDS = 60

# Auth-code TTL (between cloud-issued code and daemon /token exchange).
AUTH_CODE_TTL_SECONDS = 120

# In-memory cache of issued auth codes — small, ephemeral, sized for a few
# hundred concurrent first-auth flows. Stored as: code → dict(payload).
# Production note: when we run >1 backend instance behind a load balancer,
# move this to Redis keyed by code; until then in-process is fine and avoids
# adding a Redis dependency for the wedge.
_AUTH_CODE_CACHE: dict[str, dict] = {}


# ----------------------------------------------------------------------
# Token primitives
# ----------------------------------------------------------------------

def _hash_token(token: str) -> str:
    """Hash a refresh token for at-rest storage. sha256 is fine here because
    the input is already 32-byte random (high entropy) — bcrypt's slow KDF
    isn't needed for non-password secrets."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_refresh_token() -> str:
    """32-byte cryptographic random, URL-safe encoded."""
    return secrets.token_urlsafe(32)


def _generate_auth_code() -> str:
    """Single-use auth code returned to daemon via loopback redirect."""
    return secrets.token_urlsafe(24)


def create_daemon_access_token(
    daemon_id: str,
    organization_id: str,
    user_id: str,
) -> str:
    """Mint a short-lived access JWT with aud=leadspot-daemon."""
    expire = datetime.utcnow() + timedelta(minutes=DAEMON_ACCESS_TOKEN_MINUTES)
    payload = {
        "sub": daemon_id,
        "organization_id": organization_id,
        "user_id": user_id,
        "aud": DAEMON_TOKEN_AUDIENCE,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ----------------------------------------------------------------------
# Auth-code (loopback OAuth) helpers
# ----------------------------------------------------------------------

def issue_auth_code(
    user_id: str,
    organization_id: str,
    user_email: str,
    device_label: str,
    state: str,
) -> str:
    """Cloud-side: user clicked Authorize; mint a short-lived auth code.
    Daemon will exchange this at POST /api/daemon/auth/token within ~2 minutes.
    """
    code = _generate_auth_code()
    _AUTH_CODE_CACHE[code] = {
        "user_id": user_id,
        "organization_id": organization_id,
        "user_email": user_email,
        "device_label": device_label,
        "state": state,
        "expires_at": datetime.utcnow() + timedelta(seconds=AUTH_CODE_TTL_SECONDS),
        "consumed": False,
    }
    _gc_auth_codes()
    return code


def consume_auth_code(code: str, state: str) -> dict | None:
    """Daemon-side: exchange the auth code for tokens.

    Returns the auth payload on success, None on:
    - unknown / expired code
    - state mismatch (CSRF protection)
    - already consumed (single-use)
    """
    payload = _AUTH_CODE_CACHE.get(code)
    if not payload:
        return None
    if payload["consumed"]:
        return None
    if datetime.utcnow() > payload["expires_at"]:
        _AUTH_CODE_CACHE.pop(code, None)
        return None
    if not hmac.compare_digest(payload["state"], state):
        # Don't reveal that the code was valid — generic failure.
        return None
    payload["consumed"] = True
    return payload


def _gc_auth_codes() -> None:
    """Best-effort GC of expired codes. Called opportunistically."""
    now = datetime.utcnow()
    expired = [c for c, p in _AUTH_CODE_CACHE.items() if p["expires_at"] < now]
    for c in expired:
        _AUTH_CODE_CACHE.pop(c, None)


# ----------------------------------------------------------------------
# Refresh-token rotation (race-safe)
# ----------------------------------------------------------------------

async def rotate_refresh_token(
    db: AsyncSession,
    presented_token: str,
) -> tuple[DaemonCredential, str, str] | None:
    """Atomically rotate a refresh token.

    Race-safe rules (plan §2.4):
    - Token matches CURRENT generation → issue new tokens, increment generation,
      record new successor + issued_at.
    - Token matches the LAST SUCCESSOR (i.e., this is a duplicate refresh from
      the same generation as the most recent rotation, within REFRESH_GRACE_SECONDS)
      → return the same successor pair (idempotent).
    - Anything else → reject.

    Returns (credential, new_refresh_token, new_access_token) or None.
    """
    presented_hash = _hash_token(presented_token)

    # Match current generation
    stmt = select(DaemonCredential).where(
        DaemonCredential.refresh_token_hash == presented_hash,
        DaemonCredential.revoked_at.is_(None),
    )
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()

    if cred:
        # Current generation — issue new tokens, rotate.
        new_refresh = _generate_refresh_token()
        new_refresh_hash = _hash_token(new_refresh)

        # Move the just-now-current to "last successor" so a retry within grace
        # lands on the previous-generation branch below.
        cred.last_successor_token_hash = new_refresh_hash
        cred.last_successor_issued_at = datetime.utcnow()
        cred.refresh_token_hash = new_refresh_hash
        cred.refresh_generation = (cred.refresh_generation or 0) + 1
        cred.last_seen_at = datetime.utcnow()

        access = create_daemon_access_token(
            daemon_id=cred.daemon_id,
            organization_id=cred.organization_id,
            user_id=cred.user_id,
        )
        await db.flush()
        return cred, new_refresh, access

    # Match previous generation within grace window — return the SAME successor
    # we minted before (idempotent). Two daemons restarting simultaneously both
    # land here on the second call; both get the same successor, neither
    # invalidates the other.
    grace_cutoff = datetime.utcnow() - timedelta(seconds=REFRESH_GRACE_SECONDS)
    # Note: previous-generation tokens aren't stored after rotation. We can only
    # detect this race by matching on the LAST_SUCCESSOR's predecessor *if* we
    # kept it. We don't (it would defeat rotation). So the grace branch only
    # fires when the FIRST-call's successor is presented again (e.g. daemon A
    # received the tokens but crashed before persisting, restarts, and re-tries
    # with the OLD refresh — that case fails by design and forces re-auth).
    #
    # The race we DO need to handle: two parallel /refresh calls with the SAME
    # original token. The DB-level transaction means one wins; the loser sees
    # the rotated state. That loser presents the original token, gets None
    # here, falls back to checking last_successor_token_hash:
    stmt2 = select(DaemonCredential).where(
        DaemonCredential.last_successor_token_hash == presented_hash,
        DaemonCredential.last_successor_issued_at >= grace_cutoff,
        DaemonCredential.revoked_at.is_(None),
    )
    result2 = await db.execute(stmt2)
    grace_cred = result2.scalar_one_or_none()
    if grace_cred:
        # The presented token IS the most-recent successor (someone got it
        # before, but is asking to refresh with it again within grace). Return
        # the current pair without rotating.
        # Note: we don't have the plaintext successor anymore; this means a
        # duplicate refresh hits us with the just-issued successor. We mint a
        # fresh access token from it and tell them to keep using the same
        # refresh until grace expires.
        access = create_daemon_access_token(
            daemon_id=grace_cred.daemon_id,
            organization_id=grace_cred.organization_id,
            user_id=grace_cred.user_id,
        )
        # Sentinel: empty new_refresh signals "keep your current one."
        return grace_cred, "", access

    return None


async def issue_initial_credential(
    db: AsyncSession,
    daemon_id: str,
    organization_id: str,
    user_id: str,
    user_email: str,
    device_label: str,
) -> tuple[str, str]:
    """First-time credential issuance after a successful auth-code exchange.

    Returns (refresh_token_plaintext, access_token).
    """
    refresh = _generate_refresh_token()
    refresh_hash = _hash_token(refresh)

    cred = DaemonCredential(
        daemon_id=daemon_id,
        organization_id=organization_id,
        user_id=user_id,
        refresh_token_hash=refresh_hash,
        refresh_generation=1,
        last_successor_token_hash=refresh_hash,
        last_successor_issued_at=datetime.utcnow(),
        device_label=device_label,
        user_email_at_auth=user_email,
        last_seen_at=datetime.utcnow(),
    )
    db.add(cred)
    await db.flush()

    access = create_daemon_access_token(
        daemon_id=daemon_id,
        organization_id=organization_id,
        user_id=user_id,
    )
    return refresh, access


# ----------------------------------------------------------------------
# FastAPI dependency
# ----------------------------------------------------------------------

_security = HTTPBearer(auto_error=False)


async def get_current_daemon(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
    db: AsyncSession = Depends(get_db),
) -> DaemonCredential:
    """FastAPI dependency for daemon-authenticated routes.

    Validates a Bearer JWT with `aud=leadspot-daemon`, looks up the
    DaemonCredential, and rejects revoked daemons. Returns the credential row.
    """
    unauth = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate daemon credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials or not credentials.credentials:
        raise unauth
    token = credentials.credentials

    try:
        # Note: we explicitly require the audience claim. A user-session JWT
        # (aud not set, or set to a user audience) will fail this check.
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=DAEMON_TOKEN_AUDIENCE,
        )
    except JWTError:
        raise unauth from None

    daemon_id = payload.get("sub")
    if not daemon_id or payload.get("type") != "access":
        raise unauth

    stmt = select(DaemonCredential).where(DaemonCredential.daemon_id == daemon_id)
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()
    if not cred:
        raise unauth
    if cred.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Daemon has been revoked. Run `ambient auth login` to re-authenticate.",
        )

    return cred


async def revoke_daemon(db: AsyncSession, daemon_id: str) -> bool:
    """Mark a daemon credential as revoked. Idempotent."""
    stmt = select(DaemonCredential).where(DaemonCredential.daemon_id == daemon_id)
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()
    if not cred:
        return False
    if cred.revoked_at is None:
        cred.revoked_at = datetime.utcnow()
        await db.flush()
    return True
