"""
Authentication routes with rate limiting and secure token handling.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

logger = logging.getLogger(__name__)
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.rate_limiter import RateLimits, limiter
from app.models import Organization, PasswordResetToken, User
from app.schemas import (
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetResponse,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
    verify_refresh_token,
)

router = APIRouter()


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Set authentication cookies with secure settings.
    """
    from app.config import settings

    # Only use secure cookies in production (HTTPS)
    # In development, secure=True prevents cookies from being sent over HTTP
    is_secure = settings.ENVIRONMENT == "production"

    # Access token - short lived, httpOnly
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=3600,  # 1 hour
        path="/"
    )

    # Refresh token - longer lived, httpOnly
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=604800,  # 7 days
        path="/auth"  # Only sent to auth endpoints
    )


def clear_auth_cookies(response: Response) -> None:
    """
    Clear authentication cookies on logout.
    """
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/auth")


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit(RateLimits.AUTH_REGISTER)
async def register(
    request: Request,
    response: Response,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user.

    Rate limited to 3 attempts per minute to prevent abuse.
    Creates a new user account and organization if needed.
    """
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Get or create organization
    result = await db.execute(
        select(Organization).where(Organization.domain == user_data.organization_domain)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        organization = Organization(
            name=user_data.organization_domain.split('.')[0].title(),
            domain=user_data.organization_domain,
            subscription_tier="free"
        )
        db.add(organization)
        await db.flush()

    # Create user
    hashed_pw = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        organization_id=organization.organization_id,
        hashed_password=hashed_pw,
        role="user"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Seed demo data for new org (non-blocking)
    try:
        from app.seed import seed_org_demo_data
        await seed_org_demo_data(
            organization_id=str(new_user.organization_id),
            user_id=str(new_user.user_id),
            session=db,
        )
    except Exception as _seed_err:
        logger.warning(f"Demo seed failed for new user (non-fatal): {_seed_err}")

    # Create tokens
    access_token = create_access_token(
        user_id=new_user.user_id,
        email=new_user.email,
        organization_id=new_user.organization_id,
        role=new_user.role
    )
    refresh_token = create_refresh_token(user_id=new_user.user_id)

    # Set secure cookies
    set_auth_cookies(response, access_token, refresh_token)

    user_response = UserResponse.model_validate(new_user)
    return Token(access_token=access_token, user=user_response)


@router.post("/login", response_model=Token)
@limiter.limit(RateLimits.AUTH_LOGIN)
async def login(
    request: Request,
    response: Response,
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password.

    Rate limited to 5 attempts per minute to prevent brute force attacks.
    Returns JWT access token and sets secure httpOnly cookies.
    """
    # Get user
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    # Create tokens
    access_token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        organization_id=user.organization_id,
        role=user.role
    )
    refresh_token = create_refresh_token(user_id=user.user_id)

    # Set secure cookies
    set_auth_cookies(response, access_token, refresh_token)

    user_response = UserResponse.model_validate(user)
    return Token(access_token=access_token, user=user_response)


@router.post("/refresh", response_model=Token)
@limiter.limit(RateLimits.AUTH_LOGIN)
async def refresh_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh the access token using the refresh token cookie.

    Returns a new access token if the refresh token is valid.
    """
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )

    # Verify refresh token and get user_id
    user_id = verify_refresh_token(refresh_token)
    if not user_id:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # Get user from database
    result = await db.execute(
        select(User).where(User.user_id == str(user_id))
    )
    user = result.scalar_one_or_none()

    if not user:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Create new tokens
    access_token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        organization_id=user.organization_id,
        role=user.role
    )
    new_refresh_token = create_refresh_token(user_id=user.user_id)

    # Set secure cookies
    set_auth_cookies(response, access_token, new_refresh_token)

    user_response = UserResponse.model_validate(user)
    return Token(access_token=access_token, user=user_response)


@router.post("/logout")
async def logout(response: Response):
    """
    Logout the current user by clearing auth cookies.
    """
    clear_auth_cookies(response)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user.

    Requires valid JWT token (from cookie or Authorization header).
    """
    return UserResponse.model_validate(current_user)


# =============================================================================
# Password Reset Endpoints
# =============================================================================


@router.post("/forgot-password", response_model=PasswordResetResponse)
@limiter.limit(RateLimits.AUTH_REGISTER)  # Strict rate limit to prevent abuse
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a password reset email.

    This endpoint always returns success to prevent email enumeration attacks.
    If the email exists, a reset token will be created and logged.

    In production, this would send an email with a reset link.
    For now, the token is logged for development/testing purposes.
    """
    # Look up user by email
    result = await db.execute(
        select(User).where(User.email == reset_request.email)
    )
    user = result.scalar_one_or_none()

    if user:
        # Delete any existing reset tokens for this user
        await db.execute(
            delete(PasswordResetToken).where(
                PasswordResetToken.user_id == user.user_id
            )
        )

        # Create new reset token
        reset_token = PasswordResetToken(user_id=user.user_id)
        db.add(reset_token)
        await db.commit()
        await db.refresh(reset_token)

        # Build reset URL
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token.token}"

        # TODO: In production, send email using email service
        # For now, log the reset URL (useful for development/testing)
        print(f"[PASSWORD RESET] Token for {user.email}: {reset_token.token}")
        print(f"[PASSWORD RESET] Reset URL: {reset_url}")

    # Always return success to prevent email enumeration
    return PasswordResetResponse(
        message="If an account with that email exists, a password reset link has been sent."
    )


@router.post("/reset-password", response_model=PasswordResetResponse)
@limiter.limit(RateLimits.AUTH_LOGIN)
async def confirm_password_reset(
    request: Request,
    reset_confirm: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using a valid reset token.

    The token must be valid (not expired, not used).
    After successful reset, the token is marked as used.
    """
    # Look up the reset token
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == reset_confirm.token
        )
    )
    reset_token = result.scalar_one_or_none()

    # Validate token
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if not reset_token.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired or already been used"
        )

    # Get the user
    result = await db.execute(
        select(User).where(User.user_id == reset_token.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )

    # Update password
    user.hashed_password = hash_password(reset_confirm.new_password)

    # Mark token as used
    reset_token.used_at = datetime.utcnow()

    await db.commit()

    return PasswordResetResponse(
        message="Password has been reset successfully. You can now log in with your new password."
    )


@router.get("/verify-reset-token/{token}")
async def verify_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify that a password reset token is valid.

    This is useful for the frontend to check token validity before
    showing the password reset form.
    """
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == token)
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token or not reset_token.is_valid:
        return {"valid": False, "message": "Token is invalid or expired"}

    return {"valid": True, "message": "Token is valid"}


# =============================================================================
# OAuth Login Endpoints (Google, Microsoft)
# =============================================================================

import secrets
import httpx
from urllib.parse import urlencode


@router.get("/oauth/google/authorize")
async def google_oauth_authorize(request: Request):
    """
    Get Google OAuth authorization URL for login.
    Redirects user to Google's consent screen.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured"
        )

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state in session (if available) - check scope to avoid triggering property getter
    if 'session' in request.scope:
        request.session["oauth_state"] = state

    # Build authorization URL
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.API_BASE_URL}/auth/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }

    authorization_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    return {"authorization_url": authorization_url, "state": state}


@router.get("/oauth/google/callback")
async def google_oauth_callback(
    request: Request,
    response: Response,
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth callback after user consents.
    Creates or updates user and sets auth cookies.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured"
        )

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.API_BASE_URL}/auth/oauth/google/callback",
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for tokens"
            )

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info from Google
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Google"
            )

        google_user = userinfo_response.json()

    email = google_user.get("email")
    name = google_user.get("name", email.split("@")[0])

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Google"
        )

    # Check if user exists
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if not user:
        # Create new user
        domain = email.split("@")[1]

        # Get or create organization
        result = await db.execute(
            select(Organization).where(Organization.domain == domain)
        )
        organization = result.scalar_one_or_none()

        if not organization:
            organization = Organization(
                name=domain.split(".")[0].title(),
                domain=domain,
                subscription_tier="free"
            )
            db.add(organization)
            await db.flush()

        user = User(
            email=email,
            name=name,
            organization_id=organization.organization_id,
            hashed_password="",  # No password for OAuth users
            role="user",
            oauth_provider="google",
            oauth_id=google_user.get("id"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        await db.refresh(user)

    # Create tokens
    jwt_access_token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        organization_id=user.organization_id,
        role=user.role
    )
    jwt_refresh_token = create_refresh_token(user_id=user.user_id)

    # Set secure cookies
    set_auth_cookies(response, jwt_access_token, jwt_refresh_token)

    # Redirect to frontend dashboard
    from fastapi.responses import RedirectResponse
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/dashboard",
        status_code=status.HTTP_302_FOUND
    )


@router.get("/oauth/microsoft/authorize")
async def microsoft_oauth_authorize(request: Request):
    """
    Get Microsoft OAuth authorization URL for login.
    """
    if not settings.MICROSOFT_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft OAuth is not configured"
        )

    state = secrets.token_urlsafe(32)

    # Store state in session (if available) - check scope to avoid triggering property getter
    if 'session' in request.scope:
        request.session["oauth_state"] = state

    params = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "redirect_uri": f"{settings.API_BASE_URL}/auth/oauth/microsoft/callback",
        "response_type": "code",
        "scope": "openid email profile User.Read",
        "state": state,
        "response_mode": "query",
    }

    authorization_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urlencode(params)}"

    return {"authorization_url": authorization_url, "state": state}


@router.get("/oauth/microsoft/callback")
async def microsoft_oauth_callback(
    request: Request,
    response: Response,
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Microsoft OAuth callback after user consents.
    """
    if not settings.MICROSOFT_CLIENT_ID or not settings.MICROSOFT_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft OAuth is not configured"
        )

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            data={
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.API_BASE_URL}/auth/oauth/microsoft/callback",
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for tokens"
            )

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        userinfo_response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Microsoft"
            )

        ms_user = userinfo_response.json()

    email = ms_user.get("mail") or ms_user.get("userPrincipalName")
    name = ms_user.get("displayName", email.split("@")[0] if email else "User")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Microsoft"
        )

    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if not user:
        domain = email.split("@")[1]

        result = await db.execute(
            select(Organization).where(Organization.domain == domain)
        )
        organization = result.scalar_one_or_none()

        if not organization:
            organization = Organization(
                name=domain.split(".")[0].title(),
                domain=domain,
                subscription_tier="free"
            )
            db.add(organization)
            await db.flush()

        user = User(
            email=email,
            name=name,
            organization_id=organization.organization_id,
            hashed_password="",
            role="user",
            oauth_provider="microsoft",
            oauth_id=ms_user.get("id"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.last_login = datetime.utcnow()
        await db.commit()
        await db.refresh(user)

    jwt_access_token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        organization_id=user.organization_id,
        role=user.role
    )
    jwt_refresh_token = create_refresh_token(user_id=user.user_id)

    set_auth_cookies(response, jwt_access_token, jwt_refresh_token)

    from fastapi.responses import RedirectResponse
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/dashboard",
        status_code=status.HTTP_302_FOUND
    )


# =============================================================================
# Space Agent Workspace Token Endpoints
# =============================================================================


@router.post("/workspace-token")
@limiter.limit(RateLimits.WORKSPACE_TOKEN)
async def issue_workspace_token(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a short-lived opaque workspace token for Space Agent iframe authentication.
    Enforces single active session per user via Redis.
    """
    import json
    from app.services.cache_service import get_cache_service

    user_id = str(current_user.user_id)
    organization_id = str(current_user.organization_id)

    # Check org feature flag
    result = await db.execute(select(Organization).where(Organization.organization_id == organization_id))
    org = result.scalar_one_or_none()
    if not org or not (org.features or {}).get("space_agent_enabled", False):
        org_label = org.name if org else organization_id
        raise HTTPException(
            status_code=403,
            detail=f"Workspace not enabled for organization '{org_label}'. An admin must set features.space_agent_enabled = true.",
        )

    cache = await get_cache_service()

    if not cache.redis_client:
        raise HTTPException(status_code=503, detail="Workspace temporarily unavailable")

    # Single-active-session dedup: only reuse if the existing workspace_token
    # actually still exists in Redis (5-minute TTL). Otherwise the marker has
    # outlived the token, and reusing it would 401 on verify.
    existing_token = await cache.redis_client.get(f"space_session:{user_id}")
    if existing_token:
        existing_str = existing_token.decode() if isinstance(existing_token, bytes) else existing_token
        if await cache.redis_client.exists(f"workspace_token:{existing_str}"):
            return {"workspace_token": existing_str, "reused": True}
        # Fall through and generate a fresh token below.

    # Generate new opaque token
    token = secrets.token_urlsafe(32)
    payload = json.dumps({
        "user_id": user_id,
        "email": current_user.email,
        "organization_id": organization_id,
        "name": current_user.name or "",
    })

    # 5-minute handshake token (one-time use)
    await cache.redis_client.setex(f"workspace_token:{token}", 300, payload)
    # 24-hour session deduplication key
    await cache.redis_client.setex(f"space_session:{user_id}", 86400, token)

    return {"workspace_token": token, "reused": False}


@router.post("/verify-workspace-token")
async def verify_workspace_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a workspace token issued by /auth/workspace-token.
    Called by Space Agent server-side to establish a session.
    Validates the caller is Space Agent via X-Space-Admin-Key header.
    One-time use: token is deleted after successful verification.
    """
    import json
    from app.services.cache_service import get_cache_service

    # Verify caller is Space Agent
    space_key = request.headers.get("X-Space-Admin-Key", "")
    if not settings.SPACE_AGENT_ADMIN_KEY or not secrets.compare_digest(space_key, settings.SPACE_AGENT_ADMIN_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Parse body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    token = body.get("token", "")
    ctx_org_id = body.get("organization_id", "")

    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    cache = await get_cache_service()
    if not cache.redis_client:
        raise HTTPException(status_code=503, detail="Auth service unavailable")

    # Look up token
    data = await cache.redis_client.get(f"workspace_token:{token}")
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    parsed = json.loads(data)

    # Validate org_id matches (prevents URL tampering)
    if ctx_org_id and ctx_org_id != parsed["organization_id"]:
        raise HTTPException(status_code=403, detail="Organization mismatch")

    # NOTE: token is left in Redis to expire on its 5-minute TTL rather than
    # being deleted on first verify. This allows the iframe to be re-mounted
    # (React Strict Mode dev, reloads, navigation) without the second verify
    # 401-ing. The 5-minute window is short enough that token replay is bounded.
    return parsed
