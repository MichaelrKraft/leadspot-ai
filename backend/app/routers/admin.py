"""
Admin Panel API Router

Provides administrative endpoints for:
- User management (CRUD operations)
- Organization settings
- Audit log viewing and export
- Usage statistics and monitoring
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Role
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.admin import (
    AuditLogListResponse,
    AuditLogResponse,
    AuditStatistics,
    OrganizationResponse,
    OrganizationUpdate,
    PasswordReset,
    PermissionSummary,
    RoleInfo,
    SubscriptionLimits,
    UsageStats,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from app.services.admin import (
    AuditService,
    OrganizationAdminService,
    PermissionService,
    UserAdminService,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ===== User Management Endpoints =====

@router.get("/users", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    role: str | None = Query(None, pattern="^(admin|user|viewer)$"),
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all users in the organization.

    Requires: Admin role

    Query Parameters:
    - skip: Number of records to skip (pagination)
    - limit: Maximum records to return
    - role: Filter by role (admin, user, viewer)
    - search: Search by name or email
    """
    # Check admin permission
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = UserAdminService(db)
    users, total = await service.list_users(
        organization_id=UUID(current_user["organization_id"]),
        skip=skip,
        limit=limit,
        role_filter=role,
        search=search
    )

    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get details for a specific user.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = UserAdminService(db)
    user = await service.get_user(
        user_id=user_id,
        organization_id=UUID(current_user["organization_id"])
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user in the organization.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = UserAdminService(db)

    try:
        user = await service.create_user(
            user_data=user_data,
            organization_id=UUID(current_user["organization_id"])
        )
        await db.commit()

        # Log the action
        audit_service = AuditService(db)
        await audit_service.log_action(
            organization_id=UUID(current_user["organization_id"]),
            user_id=UUID(current_user["id"]),
            action="user.create",
            resource_type="user",
            resource_id=str(user.user_id),
            details={"email": user.email, "role": user.role}
        )
        await db.commit()

        return UserResponse.model_validate(user)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user details.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Validate role change if attempting to change role
    if user_data.role:
        perm_service = PermissionService(db)
        is_valid, error = await perm_service.validate_permission_change(
            admin_user_id=UUID(current_user["id"]),
            target_user_id=user_id,
            new_role=user_data.role
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )

    service = UserAdminService(db)

    try:
        user = await service.update_user(
            user_id=user_id,
            organization_id=UUID(current_user["organization_id"]),
            user_data=user_data
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        await db.commit()

        # Log the action
        audit_service = AuditService(db)
        await audit_service.log_action(
            organization_id=UUID(current_user["organization_id"]),
            user_id=UUID(current_user["id"]),
            action="user.update",
            resource_type="user",
            resource_id=str(user_id),
            details=user_data.model_dump(exclude_unset=True)
        )
        await db.commit()

        return UserResponse.model_validate(user)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deactivate a user (soft delete).

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Prevent self-deletion
    if str(user_id) == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    service = UserAdminService(db)
    success = await service.deactivate_user(
        user_id=user_id,
        organization_id=UUID(current_user["organization_id"])
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.commit()

    # Log the action
    audit_service = AuditService(db)
    await audit_service.log_action(
        organization_id=UUID(current_user["organization_id"]),
        user_id=UUID(current_user["id"]),
        action="user.delete",
        resource_type="user",
        resource_id=str(user_id)
    )
    await db.commit()


@router.post("/users/{user_id}/reset-password", response_model=UserResponse)
async def reset_user_password(
    user_id: UUID,
    password_data: PasswordReset,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Reset a user's password.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = UserAdminService(db)
    user = await service.reset_password(
        user_id=user_id,
        organization_id=UUID(current_user["organization_id"]),
        new_password=password_data.new_password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.commit()

    # Log the action (don't include new password!)
    audit_service = AuditService(db)
    await audit_service.log_action(
        organization_id=UUID(current_user["organization_id"]),
        user_id=UUID(current_user["id"]),
        action="user.password_reset",
        resource_type="user",
        resource_id=str(user_id)
    )
    await db.commit()

    return UserResponse.model_validate(user)


# ===== Organization Management Endpoints =====

@router.get("/organization", response_model=OrganizationResponse)
async def get_organization(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get organization details and statistics.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = OrganizationAdminService(db)
    org = await service.get_organization(
        organization_id=UUID(current_user["organization_id"])
    )

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Get user and document counts
    user_service = UserAdminService(db)
    total_users = await user_service.get_user_count(org.organization_id)

    # Build response
    org_response = OrganizationResponse.model_validate(org)
    org_response.total_users = total_users

    return org_response


@router.patch("/organization", response_model=OrganizationResponse)
async def update_organization(
    org_data: OrganizationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update organization settings.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = OrganizationAdminService(db)

    try:
        org = await service.update_organization(
            organization_id=UUID(current_user["organization_id"]),
            org_data=org_data
        )

        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        await db.commit()

        # Log the action
        audit_service = AuditService(db)
        await audit_service.log_action(
            organization_id=UUID(current_user["organization_id"]),
            user_id=UUID(current_user["id"]),
            action="organization.update",
            resource_type="organization",
            resource_id=str(org.organization_id),
            details=org_data.model_dump(exclude_unset=True)
        )
        await db.commit()

        return OrganizationResponse.model_validate(org)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/organization/subscription", response_model=SubscriptionLimits)
async def get_subscription_limits(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get subscription tier limits and current usage.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = OrganizationAdminService(db)
    limits = await service.get_subscription_limits(
        organization_id=UUID(current_user["organization_id"])
    )

    return SubscriptionLimits(**limits)


# ===== Audit Log Endpoints =====

@router.get("/audit", response_model=AuditLogListResponse)
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user_id: UUID | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    status: str | None = Query(None, pattern="^(success|failure|error)$"),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get audit logs with filtering and pagination.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = AuditService(db)
    logs, total = await service.get_audit_logs(
        organization_id=UUID(current_user["organization_id"]),
        skip=skip,
        limit=limit,
        user_id=user_id,
        action_filter=action,
        resource_type_filter=resource_type,
        status_filter=status,
        start_date=start_date,
        end_date=end_date,
        search=search
    )

    return AuditLogListResponse(
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/audit/statistics", response_model=AuditStatistics)
async def get_audit_statistics(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get audit statistics for the organization.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = AuditService(db)
    stats = await service.get_audit_statistics(
        organization_id=UUID(current_user["organization_id"]),
        days=days
    )

    return AuditStatistics(**stats)


@router.get("/audit/export")
async def export_audit_logs(
    format: str = Query("json", pattern="^(json|csv)$"),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export audit logs for compliance.

    Requires: Admin role

    Returns: Audit logs in JSON or CSV format
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = AuditService(db)
    export_data = await service.export_audit_logs(
        organization_id=UUID(current_user["organization_id"]),
        start_date=start_date,
        end_date=end_date,
        format=format
    )

    # Set appropriate content type
    media_type = "application/json" if format == "json" else "text/csv"
    filename = f"audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{format}"

    from fastapi.responses import Response
    return Response(
        content=export_data,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ===== Usage Statistics Endpoint =====

@router.get("/usage", response_model=UsageStats)
async def get_usage_statistics(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get usage statistics for the organization.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = OrganizationAdminService(db)
    stats = await service.get_usage_statistics(
        organization_id=UUID(current_user["organization_id"]),
        days=days
    )

    return stats


# ===== Permission & Role Endpoints =====

@router.get("/roles", response_model=list[RoleInfo])
async def list_roles(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get list of all available roles and their permissions.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = PermissionService(db)
    roles = service.get_available_roles()

    return [RoleInfo(**role) for role in roles]


@router.get("/users/{user_id}/permissions", response_model=PermissionSummary)
async def get_user_permissions(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get permission summary for a user.

    Requires: Admin role
    """
    if current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = PermissionService(db)
    try:
        summary = await service.get_permission_summary(user_id)
        return PermissionSummary(**summary)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
