"""
User Administration Service

Handles user management operations for admin panel:
- List users in organization
- Create and invite users
- Update user roles and details
- Deactivate/delete users
- Reset passwords
"""

import uuid
from datetime import datetime

from passlib.context import CryptContext
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import User
from app.schemas.admin import UserCreate, UserUpdate

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserAdminService:
    """Service for administrative user management operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(
        self,
        organization_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
        role_filter: str | None = None,
        search: str | None = None
    ) -> tuple[list[User], int]:
        """
        List all users in an organization with filtering and pagination.

        Args:
            organization_id: Organization to list users from
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            role_filter: Filter by specific role (admin, user, viewer)
            search: Search by name or email

        Returns:
            Tuple of (users list, total count)
        """
        # Build query
        query = select(User).where(User.organization_id == organization_id)

        # Apply filters
        if role_filter:
            query = query.where(User.role == role_filter)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                (User.name.ilike(search_term)) | (User.email.ilike(search_term))
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination and ordering
        query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)

        # Execute query
        result = await self.db.execute(query)
        users = result.scalars().all()

        return list(users), total

    async def get_user(self, user_id: uuid.UUID, organization_id: uuid.UUID) -> User | None:
        """
        Get a specific user by ID within an organization.

        Args:
            user_id: User ID to retrieve
            organization_id: Organization ID for security check

        Returns:
            User object or None if not found
        """
        result = await self.db.execute(
            select(User).where(
                User.user_id == user_id,
                User.organization_id == organization_id
            )
        )
        return result.scalar_one_or_none()

    async def create_user(
        self,
        user_data: UserCreate,
        organization_id: uuid.UUID
    ) -> User:
        """
        Create a new user in the organization.

        Args:
            user_data: User creation data (email, name, password, role)
            organization_id: Organization to add user to

        Returns:
            Created user object

        Raises:
            ValueError: If email already exists or organization not found
        """
        # Check if email already exists
        existing = await self.db.execute(
            select(User).where(User.email == user_data.email)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"User with email {user_data.email} already exists")

        # Verify organization exists
        org_result = await self.db.execute(
            select(Organization).where(Organization.organization_id == organization_id)
        )
        if not org_result.scalar_one_or_none():
            raise ValueError(f"Organization {organization_id} not found")

        # Hash password
        hashed_password = pwd_context.hash(user_data.password)

        # Create user
        new_user = User(
            email=user_data.email,
            name=user_data.name,
            organization_id=organization_id,
            role=user_data.role,
            hashed_password=hashed_password,
            created_at=datetime.utcnow()
        )

        self.db.add(new_user)
        await self.db.flush()
        await self.db.refresh(new_user)

        return new_user

    async def update_user(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_data: UserUpdate
    ) -> User | None:
        """
        Update user details.

        Args:
            user_id: User ID to update
            organization_id: Organization ID for security check
            user_data: Updated user data

        Returns:
            Updated user object or None if not found
        """
        # Get existing user
        user = await self.get_user(user_id, organization_id)
        if not user:
            return None

        # Build update dict (only include provided fields)
        update_data = {}
        if user_data.name is not None:
            update_data["name"] = user_data.name
        if user_data.role is not None:
            update_data["role"] = user_data.role
        if user_data.email is not None:
            # Check email uniqueness
            existing = await self.db.execute(
                select(User).where(
                    User.email == user_data.email,
                    User.user_id != user_id
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Email {user_data.email} already in use")
            update_data["email"] = user_data.email

        # Apply updates
        if update_data:
            await self.db.execute(
                update(User)
                .where(User.user_id == user_id)
                .values(**update_data)
            )
            await self.db.flush()
            await self.db.refresh(user)

        return user

    async def deactivate_user(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> bool:
        """
        Deactivate a user (soft delete by setting role to 'inactive').

        Args:
            user_id: User ID to deactivate
            organization_id: Organization ID for security check

        Returns:
            True if deactivated, False if user not found
        """
        result = await self.db.execute(
            update(User)
            .where(
                User.user_id == user_id,
                User.organization_id == organization_id
            )
            .values(role="inactive")
        )
        return result.rowcount > 0

    async def delete_user(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> bool:
        """
        Permanently delete a user (hard delete).

        Args:
            user_id: User ID to delete
            organization_id: Organization ID for security check

        Returns:
            True if deleted, False if user not found
        """
        result = await self.db.execute(
            delete(User).where(
                User.user_id == user_id,
                User.organization_id == organization_id
            )
        )
        return result.rowcount > 0

    async def reset_password(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        new_password: str
    ) -> User | None:
        """
        Reset a user's password.

        Args:
            user_id: User ID
            organization_id: Organization ID for security check
            new_password: New password (unhashed)

        Returns:
            Updated user or None if not found
        """
        # Hash new password
        hashed_password = pwd_context.hash(new_password)

        # Update password
        await self.db.execute(
            update(User)
            .where(
                User.user_id == user_id,
                User.organization_id == organization_id
            )
            .values(hashed_password=hashed_password)
        )

        # Return updated user
        return await self.get_user(user_id, organization_id)

    async def get_user_count(self, organization_id: uuid.UUID) -> int:
        """
        Get total count of users in organization.

        Args:
            organization_id: Organization ID

        Returns:
            Total user count
        """
        result = await self.db.execute(
            select(func.count(User.user_id))
            .where(User.organization_id == organization_id)
        )
        return result.scalar() or 0

    async def get_users_by_role(
        self,
        organization_id: uuid.UUID
    ) -> dict[str, int]:
        """
        Get user count breakdown by role.

        Args:
            organization_id: Organization ID

        Returns:
            Dictionary mapping role to count
        """
        result = await self.db.execute(
            select(User.role, func.count(User.user_id))
            .where(User.organization_id == organization_id)
            .group_by(User.role)
        )

        return {role: count for role, count in result.all()}
