"""Manage health alerts and notifications."""

import logging
from datetime import datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


class AlertService:
    """Manages health alerts, notifications, and alert lifecycle."""

    def __init__(self):
        # In-memory storage (move to database later)
        self.alerts: dict[str, dict] = {}
        self.alert_history: list[dict] = []

    async def create_alert(
        self,
        org_id: str,
        alert_type: str,
        severity: str,
        description: str,
        metadata: dict | None = None
    ) -> dict:
        """
        Create a new health alert.

        Args:
            org_id: Organization ID
            alert_type: Type of alert (conflict, outdated, knowledge_gap)
            severity: Severity level (high, medium, low)
            description: Alert description
            metadata: Additional metadata

        Returns:
            Created alert dictionary
        """
        alert_id = str(uuid4())
        alert = {
            "id": alert_id,
            "org_id": org_id,
            "type": alert_type,
            "severity": severity,
            "description": description,
            "status": "active",
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "resolved_at": None,
            "resolution": None
        }

        self.alerts[alert_id] = alert
        logger.info(f"Created alert {alert_id} for org {org_id}: {alert_type} ({severity})")

        return alert

    async def get_alerts(
        self,
        org_id: str,
        status: str | None = None,
        severity: str | None = None,
        alert_type: str | None = None
    ) -> list[dict]:
        """
        Get alerts for an organization with optional filtering.

        Args:
            org_id: Organization ID
            status: Filter by status (active, resolved, dismissed)
            severity: Filter by severity (high, medium, low)
            alert_type: Filter by type (conflict, outdated, knowledge_gap)

        Returns:
            List of matching alerts
        """
        org_alerts = [
            alert for alert in self.alerts.values()
            if alert["org_id"] == org_id
        ]

        # Apply filters
        if status:
            org_alerts = [a for a in org_alerts if a["status"] == status]
        if severity:
            org_alerts = [a for a in org_alerts if a["severity"] == severity]
        if alert_type:
            org_alerts = [a for a in org_alerts if a["type"] == alert_type]

        # Sort by severity (high > medium > low) and created_at (newest first)
        severity_order = {"high": 3, "medium": 2, "low": 1}
        org_alerts.sort(
            key=lambda x: (
                severity_order.get(x["severity"], 0),
                x["created_at"]
            ),
            reverse=True
        )

        return org_alerts

    async def get_alert(self, alert_id: str) -> dict | None:
        """
        Get a specific alert by ID.

        Args:
            alert_id: Alert ID

        Returns:
            Alert dictionary or None if not found
        """
        return self.alerts.get(alert_id)

    async def update_alert(
        self,
        alert_id: str,
        status: str | None = None,
        resolution: str | None = None
    ) -> dict | None:
        """
        Update an alert.

        Args:
            alert_id: Alert ID
            status: New status (active, resolved, dismissed)
            resolution: Resolution description

        Returns:
            Updated alert or None if not found
        """
        alert = self.alerts.get(alert_id)
        if not alert:
            logger.warning(f"Alert {alert_id} not found for update")
            return None

        # Update status
        if status:
            alert["status"] = status
            alert["updated_at"] = datetime.utcnow().isoformat()

            # Set resolved_at timestamp if resolving
            if status in ["resolved", "dismissed"]:
                alert["resolved_at"] = datetime.utcnow().isoformat()

        # Update resolution
        if resolution:
            alert["resolution"] = resolution
            alert["updated_at"] = datetime.utcnow().isoformat()

        # Add to history
        self.alert_history.append({
            "alert_id": alert_id,
            "action": "update",
            "changes": {"status": status, "resolution": resolution},
            "timestamp": datetime.utcnow().isoformat()
        })

        logger.info(f"Updated alert {alert_id}: status={status}")
        return alert

    async def dismiss_alert(self, alert_id: str, reason: str | None = None) -> dict | None:
        """
        Dismiss an alert.

        Args:
            alert_id: Alert ID
            reason: Dismissal reason

        Returns:
            Updated alert or None if not found
        """
        return await self.update_alert(
            alert_id,
            status="dismissed",
            resolution=reason or "Dismissed by user"
        )

    async def resolve_alert(self, alert_id: str, resolution: str) -> dict | None:
        """
        Resolve an alert.

        Args:
            alert_id: Alert ID
            resolution: Resolution description

        Returns:
            Updated alert or None if not found
        """
        return await self.update_alert(
            alert_id,
            status="resolved",
            resolution=resolution
        )

    async def get_alert_summary(self, org_id: str) -> dict:
        """
        Get summary statistics for organization alerts.

        Args:
            org_id: Organization ID

        Returns:
            Summary statistics dictionary
        """
        org_alerts = [
            alert for alert in self.alerts.values()
            if alert["org_id"] == org_id
        ]

        active_alerts = [a for a in org_alerts if a["status"] == "active"]

        summary = {
            "total_alerts": len(org_alerts),
            "active_alerts": len(active_alerts),
            "by_severity": {
                "high": len([a for a in active_alerts if a["severity"] == "high"]),
                "medium": len([a for a in active_alerts if a["severity"] == "medium"]),
                "low": len([a for a in active_alerts if a["severity"] == "low"])
            },
            "by_type": {
                "conflict": len([a for a in active_alerts if a["type"] == "conflict"]),
                "outdated": len([a for a in active_alerts if a["type"] == "outdated"]),
                "knowledge_gap": len([a for a in active_alerts if a["type"] == "knowledge_gap"])
            },
            "resolved_count": len([a for a in org_alerts if a["status"] == "resolved"]),
            "dismissed_count": len([a for a in org_alerts if a["status"] == "dismissed"])
        }

        return summary

    async def bulk_create_alerts(self, org_id: str, alerts_data: list[dict]) -> list[dict]:
        """
        Create multiple alerts at once.

        Args:
            org_id: Organization ID
            alerts_data: List of alert data dictionaries

        Returns:
            List of created alerts
        """
        created_alerts = []

        for alert_data in alerts_data:
            alert = await self.create_alert(
                org_id=org_id,
                alert_type=alert_data.get("type", "unknown"),
                severity=alert_data.get("severity", "low"),
                description=alert_data.get("description", ""),
                metadata=alert_data.get("metadata")
            )
            created_alerts.append(alert)

        logger.info(f"Bulk created {len(created_alerts)} alerts for org {org_id}")
        return created_alerts

    async def get_critical_alerts(self, org_id: str) -> list[dict]:
        """
        Get high-severity active alerts.

        Args:
            org_id: Organization ID

        Returns:
            List of critical alerts
        """
        return await self.get_alerts(
            org_id=org_id,
            status="active",
            severity="high"
        )

    async def auto_resolve_stale_alerts(self, org_id: str, days: int = 30) -> int:
        """
        Auto-resolve alerts that haven't been updated in specified days.

        Args:
            org_id: Organization ID
            days: Number of days for staleness threshold

        Returns:
            Number of alerts auto-resolved
        """
        cutoff_date = datetime.utcnow()
        cutoff_timestamp = (cutoff_date.timestamp() - (days * 24 * 60 * 60))

        org_alerts = await self.get_alerts(org_id=org_id, status="active")
        auto_resolved = 0

        for alert in org_alerts:
            updated_at = datetime.fromisoformat(alert["updated_at"])
            if updated_at.timestamp() < cutoff_timestamp:
                await self.resolve_alert(
                    alert["id"],
                    f"Auto-resolved: No activity for {days} days"
                )
                auto_resolved += 1

        if auto_resolved > 0:
            logger.info(f"Auto-resolved {auto_resolved} stale alerts for org {org_id}")

        return auto_resolved

    async def clear_resolved_alerts(self, org_id: str, days: int = 90) -> int:
        """
        Clear resolved alerts older than specified days.

        Args:
            org_id: Organization ID
            days: Age threshold in days

        Returns:
            Number of alerts cleared
        """
        cutoff_date = datetime.utcnow()
        cutoff_timestamp = (cutoff_date.timestamp() - (days * 24 * 60 * 60))

        org_alerts = [
            alert for alert in self.alerts.values()
            if alert["org_id"] == org_id and alert["status"] in ["resolved", "dismissed"]
        ]

        cleared = 0
        for alert in org_alerts:
            resolved_at = alert.get("resolved_at")
            if resolved_at:
                resolved_date = datetime.fromisoformat(resolved_at)
                if resolved_date.timestamp() < cutoff_timestamp:
                    # Move to history and remove from active alerts
                    self.alert_history.append({
                        "alert_id": alert["id"],
                        "action": "cleared",
                        "alert_data": alert,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    del self.alerts[alert["id"]]
                    cleared += 1

        if cleared > 0:
            logger.info(f"Cleared {cleared} old resolved alerts for org {org_id}")

        return cleared
