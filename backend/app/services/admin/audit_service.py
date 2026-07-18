"""
Audit Logging Service

Provides comprehensive audit logging for security, compliance, and troubleshooting:
- Log administrative actions
- Log sensitive operations
- Query audit trail
- Export audit logs for compliance
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditService:
    """Service for audit logging and querying"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        organization_id: uuid.UUID,
        action: str,
        resource_type: str,
        user_id: uuid.UUID | None = None,
        resource_id: str | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        status: str = "success",
        error_message: str | None = None
    ) -> AuditLog:
        """
        Log an audit event.

        Args:
            organization_id: Organization ID
            action: Action performed (e.g., "user.create", "org.update")
            resource_type: Type of resource (e.g., "user", "organization")
            user_id: User who performed the action (None for system actions)
            resource_id: ID of the affected resource
            details: Additional context as dictionary
            ip_address: Client IP address
            user_agent: Client user agent string
            status: Action status (success, failure, error)
            error_message: Error details if status is failure/error

        Returns:
            Created AuditLog object
        """
        log_entry = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            error_message=error_message,
            created_at=datetime.utcnow()
        )

        self.db.add(log_entry)
        await self.db.flush()
        await self.db.refresh(log_entry)

        return log_entry

    async def get_audit_logs(
        self,
        organization_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
        user_id: uuid.UUID | None = None,
        action_filter: str | None = None,
        resource_type_filter: str | None = None,
        status_filter: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        search: str | None = None
    ) -> tuple[list[AuditLog], int]:
        """
        Query audit logs with filtering and pagination.

        Args:
            organization_id: Organization to query logs for
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            user_id: Filter by specific user
            action_filter: Filter by action pattern (e.g., "user.*")
            resource_type_filter: Filter by resource type
            status_filter: Filter by status (success, failure, error)
            start_date: Filter logs after this date
            end_date: Filter logs before this date
            search: Search in action, resource_type, or resource_id

        Returns:
            Tuple of (logs list, total count)
        """
        # Build query
        query = select(AuditLog).where(
            AuditLog.organization_id == organization_id
        )

        # Apply filters
        if user_id:
            query = query.where(AuditLog.user_id == user_id)

        if action_filter:
            # Support wildcards (e.g., "user.*" matches "user.create", "user.update")
            if "*" in action_filter:
                pattern = action_filter.replace("*", "%")
                query = query.where(AuditLog.action.like(pattern))
            else:
                query = query.where(AuditLog.action == action_filter)

        if resource_type_filter:
            query = query.where(AuditLog.resource_type == resource_type_filter)

        if status_filter:
            query = query.where(AuditLog.status == status_filter)

        if start_date:
            query = query.where(AuditLog.created_at >= start_date)

        if end_date:
            query = query.where(AuditLog.created_at <= end_date)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    AuditLog.action.ilike(search_term),
                    AuditLog.resource_type.ilike(search_term),
                    AuditLog.resource_id.ilike(search_term)
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination and ordering
        query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)

        # Execute query
        result = await self.db.execute(query)
        logs = result.scalars().all()

        return list(logs), total

    async def get_audit_log(
        self,
        log_id: uuid.UUID,
        organization_id: uuid.UUID
    ) -> AuditLog | None:
        """
        Get a specific audit log entry.

        Args:
            log_id: Audit log ID
            organization_id: Organization ID for security check

        Returns:
            AuditLog object or None if not found
        """
        result = await self.db.execute(
            select(AuditLog).where(
                AuditLog.log_id == log_id,
                AuditLog.organization_id == organization_id
            )
        )
        return result.scalar_one_or_none()

    async def get_user_activity(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        days: int = 30
    ) -> list[AuditLog]:
        """
        Get recent activity for a specific user.

        Args:
            user_id: User ID
            organization_id: Organization ID
            days: Number of days to look back

        Returns:
            List of recent audit logs for the user
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(AuditLog)
            .where(
                AuditLog.user_id == user_id,
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= cutoff_date
            )
            .order_by(AuditLog.created_at.desc())
            .limit(100)
        )
        return list(result.scalars().all())

    async def get_audit_statistics(
        self,
        organization_id: uuid.UUID,
        days: int = 30
    ) -> dict[str, Any]:
        """
        Get audit statistics for an organization.

        Args:
            organization_id: Organization ID
            days: Number of days to analyze

        Returns:
            Dictionary with audit statistics
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Total actions
        total_result = await self.db.execute(
            select(func.count(AuditLog.log_id))
            .where(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= cutoff_date
            )
        )
        total_actions = total_result.scalar() or 0

        # Actions by status
        status_result = await self.db.execute(
            select(AuditLog.status, func.count(AuditLog.log_id))
            .where(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= cutoff_date
            )
            .group_by(AuditLog.status)
        )
        by_status = {status: count for status, count in status_result.all()}

        # Actions by type
        type_result = await self.db.execute(
            select(AuditLog.resource_type, func.count(AuditLog.log_id))
            .where(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= cutoff_date
            )
            .group_by(AuditLog.resource_type)
            .order_by(func.count(AuditLog.log_id).desc())
            .limit(10)
        )
        by_type = {resource_type: count for resource_type, count in type_result.all()}

        # Most active users
        user_result = await self.db.execute(
            select(AuditLog.user_id, func.count(AuditLog.log_id))
            .where(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= cutoff_date,
                AuditLog.user_id.isnot(None)
            )
            .group_by(AuditLog.user_id)
            .order_by(func.count(AuditLog.log_id).desc())
            .limit(10)
        )
        most_active_users = [
            {"user_id": str(user_id), "action_count": count}
            for user_id, count in user_result.all()
        ]

        # Failed actions
        failed_result = await self.db.execute(
            select(func.count(AuditLog.log_id))
            .where(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= cutoff_date,
                AuditLog.status.in_(["failure", "error"])
            )
        )
        failed_actions = failed_result.scalar() or 0

        return {
            "period_days": days,
            "total_actions": total_actions,
            "failed_actions": failed_actions,
            "success_rate": (
                ((total_actions - failed_actions) / total_actions * 100)
                if total_actions > 0 else 0
            ),
            "by_status": by_status,
            "by_resource_type": by_type,
            "most_active_users": most_active_users,
        }

    async def export_audit_logs(
        self,
        organization_id: uuid.UUID,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        format: str = "json"
    ) -> str:
        """
        Export audit logs for compliance purposes.

        Args:
            organization_id: Organization ID
            start_date: Start date for export
            end_date: End date for export
            format: Export format (json or csv)

        Returns:
            Exported data as string
        """
        # Get all logs in date range
        logs, _ = await self.get_audit_logs(
            organization_id=organization_id,
            start_date=start_date,
            end_date=end_date,
            limit=100000  # Large limit for export
        )

        if format == "json":
            # Export as JSON
            export_data = []
            for log in logs:
                export_data.append({
                    "log_id": str(log.log_id),
                    "timestamp": log.created_at.isoformat(),
                    "user_id": str(log.user_id) if log.user_id else None,
                    "action": log.action,
                    "resource_type": log.resource_type,
                    "resource_id": log.resource_id,
                    "status": log.status,
                    "ip_address": log.ip_address,
                    "details": log.details,
                    "error_message": log.error_message,
                })
            return json.dumps(export_data, indent=2)

        elif format == "csv":
            # Export as CSV
            import csv
            from io import StringIO

            output = StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow([
                "Timestamp", "User ID", "Action", "Resource Type",
                "Resource ID", "Status", "IP Address", "Error Message"
            ])

            # Write rows
            for log in logs:
                writer.writerow([
                    log.created_at.isoformat(),
                    str(log.user_id) if log.user_id else "",
                    log.action,
                    log.resource_type,
                    log.resource_id or "",
                    log.status,
                    log.ip_address or "",
                    log.error_message or "",
                ])

            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format: {format}")
