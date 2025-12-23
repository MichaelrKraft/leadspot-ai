"""
Admin Panel Pydantic Schemas

Schemas for admin panel operations:
- User management
- Organization settings
- Audit logs
- Usage statistics
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ===== User Management Schemas =====

class UserCreate(BaseModel):
    """Schema for creating a new user (admin action)"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=100)
    role: str = Field(default="user", pattern="^(admin|user|viewer)$")


class UserUpdate(BaseModel):
    """Schema for updating user details"""
    name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role: str | None = Field(None, pattern="^(admin|user|viewer|inactive)$")


class UserResponse(BaseModel):
    """Schema for user response in admin panel"""
    user_id: UUID
    email: str
    name: str
    organization_id: UUID
    role: str
    created_at: datetime
    last_login: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """Schema for paginated user list"""
    users: list[UserResponse]
    total: int
    skip: int
    limit: int


class PasswordReset(BaseModel):
    """Schema for password reset"""
    new_password: str = Field(..., min_length=8, max_length=100)


# ===== Organization Management Schemas =====

class OrganizationUpdate(BaseModel):
    """Schema for updating organization settings"""
    name: str | None = Field(None, min_length=1, max_length=255)
    domain: str | None = Field(None, min_length=1, max_length=255)
    subscription_tier: str | None = Field(
        None,
        pattern="^(pilot|growth|enterprise)$"
    )


class OrganizationResponse(BaseModel):
    """Schema for organization details response"""
    organization_id: UUID
    name: str
    domain: str
    subscription_tier: str
    created_at: datetime
    total_users: int | None = None
    total_documents: int | None = None

    model_config = ConfigDict(from_attributes=True)


class SubscriptionLimits(BaseModel):
    """Schema for subscription tier limits"""
    subscription_tier: str
    limits: dict[str, Any]
    current_usage: dict[str, Any]
    usage_percentage: dict[str, float]


# ===== Audit Log Schemas =====

class AuditLogResponse(BaseModel):
    """Schema for audit log entry"""
    log_id: UUID
    organization_id: UUID
    user_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    details: dict[str, Any] | None
    ip_address: str | None
    user_agent: str | None
    status: str
    error_message: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    """Schema for paginated audit log list"""
    logs: list[AuditLogResponse]
    total: int
    skip: int
    limit: int


class AuditLogFilters(BaseModel):
    """Schema for audit log filtering"""
    user_id: UUID | None = None
    action: str | None = None
    resource_type: str | None = None
    status: str | None = Field(None, pattern="^(success|failure|error)$")
    start_date: datetime | None = None
    end_date: datetime | None = None
    search: str | None = None


class AuditStatistics(BaseModel):
    """Schema for audit statistics"""
    period_days: int
    total_actions: int
    failed_actions: int
    success_rate: float
    by_status: dict[str, int]
    by_resource_type: dict[str, int]
    most_active_users: list[dict[str, Any]]


# ===== Usage Statistics Schemas =====

class UsageStats(BaseModel):
    """Schema for organization usage statistics"""
    organization_id: UUID
    period_days: int
    total_users: int
    active_users: int
    total_documents: int
    total_queries: int
    queries_last_period: int
    storage_bytes: int
    avg_queries_per_user: float
    calculated_at: datetime


class UserActivitySummary(BaseModel):
    """Schema for user activity summary"""
    user_id: UUID
    total_actions: int
    last_activity: datetime | None
    actions_by_type: dict[str, int]


# ===== Permission Schemas =====

class RoleInfo(BaseModel):
    """Schema for role information"""
    name: str
    display_name: str
    permissions: list[str]
    permission_count: int


class PermissionSummary(BaseModel):
    """Schema for user permission summary"""
    user_id: UUID
    role: str
    permissions: list[str]
    capabilities: dict[str, bool]


# ===== Batch Operations =====

class BatchUserCreate(BaseModel):
    """Schema for batch user creation"""
    users: list[UserCreate]


class BatchUserResponse(BaseModel):
    """Schema for batch operation response"""
    created: list[UserResponse]
    failed: list[dict[str, str]]  # {email: error_message}
    total_attempted: int
    total_created: int
    total_failed: int


# ===== Admin Dashboard Schemas =====

class AdminDashboardStats(BaseModel):
    """Schema for admin dashboard overview"""
    organization: OrganizationResponse
    usage: UsageStats
    subscription: SubscriptionLimits
    recent_audit_logs: list[AuditLogResponse]
    user_breakdown: dict[str, int]  # {role: count}


class SystemHealthCheck(BaseModel):
    """Schema for system health monitoring"""
    status: str  # healthy, degraded, unhealthy
    database_status: str
    api_status: str
    last_checked: datetime
    error_rate_24h: float
    avg_response_time_ms: float
