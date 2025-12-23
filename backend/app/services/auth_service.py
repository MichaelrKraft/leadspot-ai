"""
Authentication service with secure token handling.

Features:
- Short-lived access tokens (1 hour)
- Long-lived refresh tokens (7 days)
- Support for both cookie and header-based authentication
- Bcrypt password hashing
"""

from datetime import datetime, timedelta
from uuid import UUID

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import TokenData

# HTTP Bearer token scheme (optional - for backward compatibility)
security = HTTPBearer(auto_error=False)

# Token expiration settings
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 days


def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(
    user_id: UUID,
    email: str,
    organization_id: UUID,
    role: str,
    expires_delta: timedelta | None = None
) -> str:
    """
    Create a short-lived JWT access token.

    Args:
        user_id: User's UUID
        email: User's email
        organization_id: Organization's UUID
        role: User's role
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "organization_id": str(organization_id),
        "role": role,
        "exp": expire,
        "type": "access"
    }

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    user_id: UUID,
    expires_delta: timedelta | None = None
) -> str:
    """
    Create a long-lived refresh token.

    Refresh tokens only contain user_id and are used to get new access tokens.

    Args:
        user_id: User's UUID
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT refresh token string
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh"
    }

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def verify_refresh_token(token: str) -> UUID | None:
    """
    Verify a refresh token and return the user_id.

    Args:
        token: The refresh token to verify

    Returns:
        User UUID if valid, None otherwise
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        # Verify this is a refresh token
        if payload.get("type") != "refresh":
            return None

        user_id = payload.get("sub")
        if user_id is None:
            return None

        return UUID(user_id)

    except JWTError:
        return None


def extract_token_from_request(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """
    Extract JWT token from request.

    Checks in order:
    1. Authorization header (Bearer token)
    2. access_token cookie

    Args:
        request: FastAPI request object
        credentials: Optional HTTP Bearer credentials

    Returns:
        Token string if found, None otherwise
    """
    # First check Authorization header
    if credentials and credentials.credentials:
        return credentials.credentials

    # Then check cookie
    token = request.cookies.get("access_token")
    if token:
        return token

    return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user.

    Supports both:
    - Authorization: Bearer <token> header
    - access_token cookie (httpOnly)

    Args:
        request: FastAPI request object
        credentials: Optional HTTP Bearer credentials
        db: Database session

    Returns:
        Current authenticated user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )

    # Extract token from request
    token = extract_token_from_request(request, credentials)
    if not token:
        raise credentials_exception

    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        # Verify this is an access token
        if payload.get("type") == "refresh":
            raise credentials_exception

        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        organization_id: str = payload.get("organization_id")
        role: str = payload.get("role")

        if user_id is None or email is None:
            raise credentials_exception

        token_data = TokenData(
            user_id=UUID(user_id),
            email=email,
            organization_id=UUID(organization_id),
            role=role
        )

    except JWTError:
        raise credentials_exception

    # Get user from database
    result = await db.execute(
        select(User).where(User.user_id == str(token_data.user_id))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def require_role(
    required_role: str,
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to require a specific role.

    Args:
        required_role: Required role string (e.g., 'admin')
        current_user: Current authenticated user

    Returns:
        Current user if they have the required role

    Raises:
        HTTPException: If user doesn't have required role
    """
    if current_user.role != required_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required role: {required_role}"
        )
    return current_user
