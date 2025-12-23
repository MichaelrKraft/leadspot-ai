"""
Permission Service

Handles permission checks and role management.
Integrates with the core permissions module.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ROLE_PERMISSIONS, Permission, Role
from app.models.user import User


class PermissionService:
    """Service for managing permissions and roles"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_permissions(
        self,
        user_id: uuid.UUID
    ) -> list[Permission]:
        """
        Get all permissions for a user based on their role.

        Args:
            user_id: User ID

        Returns:
            List of Permission enums

        Raises:
            ValueError: If user not found
        """
        # Get user
        result = await self.db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError(f"User {user_id} not found")

        # Get permissions for user's role
        try:
            role = Role(user.role)
            return ROLE_PERMISSIONS.get(role, [])
        except ValueError:
            # Invalid role, return empty permissions
            return []

    async def check_user_permission(
        self,
        user_id: uuid.UUID,
        permission: Permission
    ) -> bool:
        """
        Check if a user has a specific permission.

        Args:
            user_id: User ID
            permission: Permission to check

        Returns:
            True if user has permission, False otherwise
        """
        try:
            user_permissions = await self.get_user_permissions(user_id)
            return permission in user_permissions
        except ValueError:
            return False

    async def check_user_role(
        self,
        user_id: uuid.UUID,
        required_role: Role
    ) -> bool:
        """
        Check if a user has a specific role.

        Args:
            user_id: User ID
            required_role: Required role

        Returns:
            True if user has role, False otherwise
        """
        result = await self.db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False

        return user.role == required_role.value

    async def is_admin(self, user_id: uuid.UUID) -> bool:
        """
        Check if user is an admin.

        Args:
            user_id: User ID

        Returns:
            True if user is admin, False otherwise
        """
        return await self.check_user_role(user_id, Role.ADMIN)

    def get_available_roles(self) -> list[dict]:
        """
        Get list of all available roles with their permissions.

        Returns:
            List of role dictionaries with permissions
        """
        roles = []
        for role in Role:
            roles.append({
                "name": role.value,
                "display_name": role.value.title(),
                "permissions": [p.value for p in ROLE_PERMISSIONS.get(role, [])],
                "permission_count": len(ROLE_PERMISSIONS.get(role, []))
            })
        return roles

    def get_role_permissions(self, role: str) -> list[str]:
        """
        Get all permissions for a specific role.

        Args:
            role: Role name (admin, user, viewer)

        Returns:
            List of permission strings
        """
        try:
            role_enum = Role(role)
            return [p.value for p in ROLE_PERMISSIONS.get(role_enum, [])]
        except ValueError:
            return []

    async def validate_permission_change(
        self,
        admin_user_id: uuid.UUID,
        target_user_id: uuid.UUID,
        new_role: str
    ) -> tuple[bool, str | None]:
        """
        Validate if an admin can change a user's role.

        Rules:
        - Admin can change any user's role in their organization
        - Users cannot change their own role
        - Cannot demote the last admin in an organization

        Args:
            admin_user_id: ID of admin making the change
            target_user_id: ID of user being changed
            new_role: New role to assign

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if admin is trying to change their own role
        if admin_user_id == target_user_id:
            return False, "Cannot change your own role"

        # Validate new role
        try:
            Role(new_role)
        except ValueError:
            return False, f"Invalid role: {new_role}"

        # Get both users
        result = await self.db.execute(
            select(User).where(User.user_id.in_([admin_user_id, target_user_id]))
        )
        users = {u.user_id: u for u in result.scalars().all()}

        admin_user = users.get(admin_user_id)
        target_user = users.get(target_user_id)

        if not admin_user or not target_user:
            return False, "User not found"

        # Check same organization
        if admin_user.organization_id != target_user.organization_id:
            return False, "Cannot modify users from different organizations"

        # If demoting an admin, check if they're the last admin
        if target_user.role == "admin" and new_role != "admin":
            admin_count_result = await self.db.execute(
                select(User).where(
                    User.organization_id == admin_user.organization_id,
                    User.role == "admin"
                )
            )
            admin_count = len(admin_count_result.scalars().all())

            if admin_count <= 1:
                return False, "Cannot demote the last admin in the organization"

        return True, None

    async def get_permission_summary(
        self,
        user_id: uuid.UUID
    ) -> dict:
        """
        Get a comprehensive permission summary for a user.

        Args:
            user_id: User ID

        Returns:
            Dictionary with role, permissions, and capabilities
        """
        result = await self.db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError(f"User {user_id} not found")

        permissions = await self.get_user_permissions(user_id)

        return {
            "user_id": str(user.user_id),
            "role": user.role,
            "permissions": [p.value for p in permissions],
            "capabilities": {
                "can_manage_users": Permission.USER_CREATE in permissions,
                "can_manage_org": Permission.ORG_UPDATE in permissions,
                "can_delete_documents": Permission.DOCUMENT_DELETE in permissions,
                "can_view_audit_logs": Permission.AUDIT_READ in permissions,
                "is_admin": user.role == Role.ADMIN.value,
            }
        }
