"""
Permission and Role Management

Defines role-based access control (RBAC) system with decorators
for protecting routes based on user roles and permissions.
"""

from collections.abc import Callable
from enum import Enum
from functools import wraps

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User


class Role(str, Enum):
    """User roles in the system"""
    ADMIN = "admin"           # Full system access
    USER = "user"             # Standard user access
    VIEWER = "viewer"         # Read-only access


class Permission(str, Enum):
    """Granular permissions for different actions"""
    # User management
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"

    # Organization management
    ORG_READ = "org:read"
    ORG_UPDATE = "org:update"
    ORG_DELETE = "org:delete"

    # Document management
    DOCUMENT_CREATE = "document:create"
    DOCUMENT_READ = "document:read"
    DOCUMENT_UPDATE = "document:update"
    DOCUMENT_DELETE = "document:delete"

    # Query operations
    QUERY_EXECUTE = "query:execute"
    QUERY_HISTORY = "query:history"

    # Audit logs
    AUDIT_READ = "audit:read"
    AUDIT_EXPORT = "audit:export"

    # Admin operations
    ADMIN_ALL = "admin:all"


# Permission matrix: which roles have which permissions
ROLE_PERMISSIONS: dict[Role, list[Permission]] = {
    Role.ADMIN: [
        # All permissions
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.ORG_READ,
        Permission.ORG_UPDATE,
        Permission.ORG_DELETE,
        Permission.DOCUMENT_CREATE,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_UPDATE,
        Permission.DOCUMENT_DELETE,
        Permission.QUERY_EXECUTE,
        Permission.QUERY_HISTORY,
        Permission.AUDIT_READ,
        Permission.AUDIT_EXPORT,
        Permission.ADMIN_ALL,
    ],
    Role.USER: [
        # Standard user permissions
        Permission.USER_READ,
        Permission.ORG_READ,
        Permission.DOCUMENT_CREATE,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_UPDATE,
        Permission.DOCUMENT_DELETE,
        Permission.QUERY_EXECUTE,
        Permission.QUERY_HISTORY,
    ],
    Role.VIEWER: [
        # Read-only permissions
        Permission.USER_READ,
        Permission.ORG_READ,
        Permission.DOCUMENT_READ,
        Permission.QUERY_EXECUTE,
    ],
}


def has_permission(user_role: str, required_permission: Permission) -> bool:
    """
    Check if a user role has a specific permission.

    Args:
        user_role: User's role as string
        required_permission: Permission to check

    Returns:
        True if user has permission, False otherwise
    """
    try:
        role = Role(user_role)
        return required_permission in ROLE_PERMISSIONS.get(role, [])
    except ValueError:
        return False


def require_permission(permission: Permission):
    """
    Decorator to require a specific permission for a route.

    Usage:
        @router.get("/users")
        @require_permission(Permission.USER_READ)
        async def list_users(current_user: dict = Depends(get_current_user)):
            ...

    Args:
        permission: Required permission

    Raises:
        HTTPException: 403 if user lacks permission
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )

            # Check permission
            user_role = current_user.get('role', 'viewer')
            if not has_permission(user_role, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission.value} required"
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_admin(func: Callable) -> Callable:
    """
    Decorator to require admin role for a route.

    Usage:
        @router.delete("/users/{user_id}")
        @require_admin
        async def delete_user(user_id: UUID, current_user: dict = Depends(get_current_user)):
            ...

    Raises:
        HTTPException: 403 if user is not admin
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        current_user = kwargs.get('current_user')
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        if current_user.get('role') != Role.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )

        return await func(*args, **kwargs)
    return wrapper


async def get_user_with_role(
    user_id: str,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get user with role information.

    Args:
        user_id: User ID from JWT token
        db: Database session

    Returns:
        User dict with role and permissions

    Raises:
        HTTPException: 404 if user not found
    """
    from uuid import UUID

    result = await db.execute(
        select(User).where(User.user_id == UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": str(user.user_id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "organization_id": str(user.organization_id),
        "permissions": [p.value for p in ROLE_PERMISSIONS.get(Role(user.role), [])]
    }


def check_same_organization(current_user: dict, target_org_id: str) -> bool:
    """
    Verify user is accessing resources within their own organization.

    Args:
        current_user: Current user dict from JWT
        target_org_id: Organization ID being accessed

    Returns:
        True if same organization, False otherwise
    """
    return str(current_user.get('organization_id')) == str(target_org_id)
