"""Daemon authentication router (loopback OAuth + refresh + device mgmt).

Mounted at prefix `/api/daemon/auth` (see app/main.py).

Endpoints:
- GET    /            -> browser approve page (user JWT)
- POST   /approve     -> issue auth code + return loopback redirect (user JWT)
- POST   /token       -> code -> tokens (no auth; this IS the auth)
- POST   /refresh     -> rotate refresh token (no bearer auth)
- GET    /devices     -> list user's daemons (user JWT)
- DELETE /devices/{daemon_id} -> revoke daemon (user JWT)

Plus a sibling router for /api/daemon/version (mounted under /api/daemon).
That endpoint is exported separately at the bottom; both routers are
included from main.py with appropriate prefixes.

See plan §2.4.
"""

import html
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DaemonCredential, User
from app.services.auth_service import get_current_user
from app.services.daemon_auth_service import (
    DAEMON_ACCESS_TOKEN_MINUTES,
    consume_auth_code,
    issue_auth_code,
    issue_initial_credential,
    revoke_daemon,
    rotate_refresh_token,
)

logger = logging.getLogger(__name__)

# Server / daemon version constants. Bump in lockstep with daemon releases.
SERVER_VERSION = "1.0.0"
MIN_DAEMON_VERSION = "1.0.0"
CURRENT_DAEMON_VERSION = "1.0.0"


router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class DaemonAuthApproveRequest(BaseModel):
    cb: str = Field(..., description="Loopback callback URL the daemon is listening on")
    state: str = Field(..., description="CSRF token issued by the daemon")
    device_label: str = Field(default="", max_length=255)


class DaemonAuthApproveResponse(BaseModel):
    redirect_url: str


class DaemonTokenRequest(BaseModel):
    code: str
    state: str


class DaemonTokenResponse(BaseModel):
    daemon_id: str
    organization_id: str
    user_email: str
    user_email_aliases: list[str] = []
    refresh_token: str
    access_token: str
    expires_in: int


class DaemonRefreshRequest(BaseModel):
    refresh_token: str


class DaemonRefreshResponse(BaseModel):
    refresh_token: str
    access_token: str
    expires_in: int


class DaemonDeviceResponse(BaseModel):
    daemon_id: str
    device_label: str
    last_seen_at: Optional[str] = None
    created_at: str


class DaemonDevicesListResponse(BaseModel):
    devices: list[DaemonDeviceResponse]


class DaemonVersionResponse(BaseModel):
    server_version: str
    min_daemon_version: str
    current_daemon_version: str


# =============================================================================
# Helpers
# =============================================================================

def _is_loopback_cb(cb: str) -> bool:
    """Anti-phishing: only redirect to localhost loopback. No remote callbacks
    ever. The daemon spins a server on a free localhost port; the cb is
    `http://localhost:<port>/cb` or `http://127.0.0.1:<port>/cb`.
    """
    if not cb:
        return False
    return cb.startswith("http://localhost:") or cb.startswith("http://127.0.0.1:")


def _parse_version(v: str) -> tuple[int, int, int]:
    """Tolerant SemVer parse: 'a.b.c-tag' -> (a, b, c). Unparseable -> (0,0,0)."""
    if not v:
        return (0, 0, 0)
    base = v.split("-", 1)[0]
    parts = base.split(".")
    out = [0, 0, 0]
    for i in range(min(3, len(parts))):
        try:
            out[i] = int(parts[i])
        except ValueError:
            out[i] = 0
    return (out[0], out[1], out[2])


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/", response_class=HTMLResponse)
async def daemon_auth_page(
    cb: str,
    state: str,
    device_label: str = "",
    current_user: User = Depends(get_current_user),
):
    """Browser-facing approval page.

    The daemon opens this URL in the user's browser. The user is already
    logged into LeadSpot (cookie-auth via get_current_user). They click
    "Authorize this Mac"; the page POSTs to /approve and is redirected to the
    daemon's loopback callback.

    Inline HTML for v1 — moving to a Next.js page later is a refactor, not a
    rewrite. The page gates on user JWT so unauthenticated browsers can't
    issue codes.
    """
    if not _is_loopback_cb(cb):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Callback URL must point at localhost (loopback OAuth only).",
        )

    safe_cb = html.escape(cb)
    safe_state = html.escape(state)
    safe_label = html.escape(device_label or "this Mac")
    safe_email = html.escape(current_user.email or "")

    # JS-safe JSON literals for the fetch body. Distinct from HTML-escaped
    # versions because the fetch body sits inside a <script> block, not text.
    js_cb = json.dumps(cb)
    js_state = json.dumps(state)
    js_label = json.dumps(device_label or "")

    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Authorize Ambient Daemon — LeadSpot</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "SF Pro", sans-serif;
            background: #0b0b0c; color: #f3f3f4; padding: 64px 24px;
            display: flex; flex-direction: column; align-items: center; }}
    .card {{ max-width: 480px; background: #18181b; padding: 32px;
             border-radius: 12px; border: 1px solid #27272a; }}
    h1 {{ font-size: 22px; margin: 0 0 12px; }}
    p {{ color: #a1a1aa; line-height: 1.5; }}
    code {{ background: #27272a; padding: 2px 6px; border-radius: 4px;
            font-size: 13px; }}
    button {{ width: 100%; padding: 12px; margin-top: 24px;
              background: #6366f1; color: white; border: 0;
              border-radius: 8px; font-size: 15px; cursor: pointer; }}
    button:hover {{ background: #5253d3; }}
    .meta {{ font-size: 12px; color: #71717a; margin-top: 18px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Ambient on {safe_label}?</h1>
    <p>The Ambient daemon will be allowed to push activity signals to your
    LeadSpot CRM under <code>{safe_email}</code>. You can revoke this device
    anytime from Settings.</p>
    <button id="approve">Authorize this Mac</button>
    <div class="meta">Loopback callback: <code>{safe_cb}</code></div>
  </div>
  <script>
    document.getElementById('approve').addEventListener('click', async () => {{
      const btn = document.getElementById('approve');
      btn.disabled = true; btn.textContent = 'Authorizing…';
      try {{
        const res = await fetch('/api/daemon/auth/approve', {{
          method: 'POST',
          credentials: 'include',
          headers: {{'Content-Type': 'application/json'}},
          body: JSON.stringify({{
            cb: {js_cb},
            state: {js_state},
            device_label: {js_label},
          }}),
        }});
        if (!res.ok) {{ throw new Error('Authorization failed: ' + res.status); }}
        const data = await res.json();
        window.location.href = data.redirect_url;
      }} catch (err) {{
        btn.disabled = false; btn.textContent = 'Try again';
        alert(err.message || 'Authorization failed');
      }}
    }});
  </script>
</body>
</html>"""
    return HTMLResponse(content=page)


@router.post("/approve", response_model=DaemonAuthApproveResponse)
async def daemon_auth_approve(
    body: DaemonAuthApproveRequest,
    current_user: User = Depends(get_current_user),
):
    """User clicked "Authorize" on the browser page.

    Issues a single-use auth code, returns a loopback redirect URL the browser
    will navigate to. The daemon's loopback server picks up the code and
    exchanges it at /token.
    """
    if not _is_loopback_cb(body.cb):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Callback URL must point at localhost (loopback OAuth only).",
        )

    code = issue_auth_code(
        user_id=str(current_user.user_id),
        organization_id=str(current_user.organization_id),
        user_email=current_user.email,
        device_label=body.device_label or "",
        state=body.state,
    )

    sep = "&" if "?" in body.cb else "?"
    redirect_url = f"{body.cb}{sep}code={code}&state={body.state}"
    return DaemonAuthApproveResponse(redirect_url=redirect_url)


@router.post("/token", response_model=DaemonTokenResponse)
async def daemon_auth_token(
    body: DaemonTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Daemon-side: exchange auth code for tokens. NO bearer auth — the auth
    code IS the credential here.
    """
    payload = consume_auth_code(body.code, body.state)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or already-used auth code.",
        )

    daemon_id = str(uuid.uuid4())
    refresh_token, access_token = await issue_initial_credential(
        db=db,
        daemon_id=daemon_id,
        organization_id=payload["organization_id"],
        user_id=payload["user_id"],
        user_email=payload["user_email"],
        device_label=payload.get("device_label") or "",
    )

    return DaemonTokenResponse(
        daemon_id=daemon_id,
        organization_id=payload["organization_id"],
        user_email=payload["user_email"],
        # Aliases not yet a separate user-aliases table; daemon will manage
        # locally via `ambient identity add`. Returning [] keeps the contract
        # forward-compatible.
        user_email_aliases=[],
        refresh_token=refresh_token,
        access_token=access_token,
        expires_in=DAEMON_ACCESS_TOKEN_MINUTES * 60,
    )


@router.post("/refresh", response_model=DaemonRefreshResponse)
async def daemon_auth_refresh(
    body: DaemonRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Rotate refresh token. NO bearer auth — the refresh token IS the credential.

    Race-safe rules in services/daemon_auth_service.rotate_refresh_token. If
    the rotation hits the grace branch (sentinel `new_refresh == ""`), return
    the same refresh token the daemon presented so it keeps working until the
    grace window expires.
    """
    result = await rotate_refresh_token(db, body.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    _cred, new_refresh, access_token = result
    refresh_to_return = new_refresh if new_refresh else body.refresh_token
    return DaemonRefreshResponse(
        refresh_token=refresh_to_return,
        access_token=access_token,
        expires_in=DAEMON_ACCESS_TOKEN_MINUTES * 60,
    )


@router.get("/devices", response_model=DaemonDevicesListResponse)
async def daemon_auth_list_devices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all non-revoked daemons for the current user."""
    stmt = (
        select(DaemonCredential)
        .where(
            DaemonCredential.user_id == str(current_user.user_id),
            DaemonCredential.revoked_at.is_(None),
        )
        .order_by(DaemonCredential.created_at.desc())
    )
    result = await db.execute(stmt)
    creds = result.scalars().all()

    return DaemonDevicesListResponse(
        devices=[
            DaemonDeviceResponse(
                daemon_id=c.daemon_id,
                device_label=c.device_label or "",
                last_seen_at=c.last_seen_at.isoformat() if c.last_seen_at else None,
                created_at=c.created_at.isoformat() if c.created_at else datetime.utcnow().isoformat(),
            )
            for c in creds
        ]
    )


@router.delete("/devices/{daemon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def daemon_auth_revoke_device(
    daemon_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Revoke a daemon. Only the owner can revoke their own daemons."""
    stmt = select(DaemonCredential).where(DaemonCredential.daemon_id == daemon_id)
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daemon not found")
    if cred.user_id != str(current_user.user_id):
        # Don't reveal existence to other users.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daemon not found")
    await revoke_daemon(db, daemon_id)


# =============================================================================
# Version endpoint — mounted under /api/daemon (no /auth prefix)
# =============================================================================

version_router = APIRouter()


@version_router.get("/version", response_model=DaemonVersionResponse)
async def daemon_version(
    x_daemon_version: Optional[str] = Header(default=None, alias="X-Daemon-Version"),
):
    """Public version-check.

    If the daemon advertises a version below MIN_DAEMON_VERSION via the
    `X-Daemon-Version` header, return 426 Upgrade Required so the daemon
    suspends promotions and prompts an update. No daemon header (older builds)
    is treated as pass-through; the cloud will reject signal posts via
    `schema_version` checks instead.
    """
    if x_daemon_version:
        if _parse_version(x_daemon_version) < _parse_version(MIN_DAEMON_VERSION):
            raise HTTPException(
                status_code=status.HTTP_426_UPGRADE_REQUIRED,
                detail=(
                    f"Daemon version {x_daemon_version} is below minimum "
                    f"{MIN_DAEMON_VERSION}. Please update."
                ),
            )

    return DaemonVersionResponse(
        server_version=SERVER_VERSION,
        min_daemon_version=MIN_DAEMON_VERSION,
        current_daemon_version=CURRENT_DAEMON_VERSION,
    )
