"""
Alert manager for monitoring thresholds and sending notifications.
"""
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class Alert:
    """Alert data structure."""
    name: str
    severity: str  # critical, warning, info
    message: str
    timestamp: datetime
    details: dict[str, Any]


@dataclass
class AlertRule:
    """Alert rule configuration."""
    name: str
    metric: str
    threshold: float
    comparison: str  # gt, lt, gte, lte, eq
    window_seconds: int
    severity: str
    enabled: bool = True


class AlertManager:
    """Manager for monitoring alerts and notifications."""

    def __init__(
        self,
        slack_webhook_url: str | None = None,
        email_config: dict[str, Any] | None = None
    ):
        self.slack_webhook_url = slack_webhook_url
        self.email_config = email_config
        self.active_alerts: dict[str, Alert] = {}
        self.alert_history: list[Alert] = []
        self.rules: list[AlertRule] = self._initialize_rules()

    def _initialize_rules(self) -> list[AlertRule]:
        """Initialize default alert rules."""
        return [
            # Error rate alerts
            AlertRule(
                name='high_error_rate',
                metric='error_rate',
                threshold=0.05,  # 5%
                comparison='gt',
                window_seconds=300,  # 5 minutes
                severity='critical'
            ),
            AlertRule(
                name='elevated_error_rate',
                metric='error_rate',
                threshold=0.02,  # 2%
                comparison='gt',
                window_seconds=300,
                severity='warning'
            ),

            # Latency alerts
            AlertRule(
                name='high_p95_latency',
                metric='request_duration_p95',
                threshold=5.0,  # 5 seconds
                comparison='gt',
                window_seconds=300,
                severity='warning'
            ),
            AlertRule(
                name='critical_p99_latency',
                metric='request_duration_p99',
                threshold=10.0,  # 10 seconds
                comparison='gt',
                window_seconds=300,
                severity='critical'
            ),

            # Query performance alerts
            AlertRule(
                name='slow_queries',
                metric='query_duration_p95',
                threshold=30.0,  # 30 seconds
                comparison='gt',
                window_seconds=600,
                severity='warning'
            ),

            # Resource alerts
            AlertRule(
                name='high_db_connections',
                metric='db_connections',
                threshold=80,  # 80% of max
                comparison='gt',
                window_seconds=300,
                severity='warning'
            ),

            # Service health alerts
            AlertRule(
                name='service_unhealthy',
                metric='health_check_failures',
                threshold=3,  # 3 consecutive failures
                comparison='gte',
                window_seconds=180,
                severity='critical'
            ),

            # Rate limiting alerts
            AlertRule(
                name='high_rate_limit_hits',
                metric='rate_limit_exceeded_rate',
                threshold=0.1,  # 10% of requests
                comparison='gt',
                window_seconds=300,
                severity='warning'
            ),
        ]

    async def evaluate_rules(self, metrics: dict[str, float]) -> list[Alert]:
        """
        Evaluate alert rules against current metrics.

        Args:
            metrics: Dictionary of metric values

        Returns:
            List of triggered alerts
        """
        triggered_alerts = []

        for rule in self.rules:
            if not rule.enabled:
                continue

            if rule.metric not in metrics:
                continue

            metric_value = metrics[rule.metric]
            should_alert = self._evaluate_threshold(
                metric_value,
                rule.threshold,
                rule.comparison
            )

            if should_alert:
                alert = Alert(
                    name=rule.name,
                    severity=rule.severity,
                    message=f"{rule.metric} {rule.comparison} {rule.threshold}",
                    timestamp=datetime.utcnow(),
                    details={
                        'metric': rule.metric,
                        'value': metric_value,
                        'threshold': rule.threshold,
                        'window_seconds': rule.window_seconds
                    }
                )
                triggered_alerts.append(alert)

                # Send notification
                await self._send_alert(alert)

        return triggered_alerts

    def _evaluate_threshold(
        self,
        value: float,
        threshold: float,
        comparison: str
    ) -> bool:
        """Evaluate if value breaches threshold."""
        comparisons = {
            'gt': value > threshold,
            'lt': value < threshold,
            'gte': value >= threshold,
            'lte': value <= threshold,
            'eq': value == threshold,
        }
        return comparisons.get(comparison, False)

    async def _send_alert(self, alert: Alert) -> None:
        """
        Send alert notification.

        Args:
            alert: Alert to send
        """
        # Prevent duplicate alerts within 5 minutes
        if self._is_duplicate_alert(alert):
            logger.debug(f"Skipping duplicate alert: {alert.name}")
            return

        # Store alert
        self.active_alerts[alert.name] = alert
        self.alert_history.append(alert)

        # Keep only last 1000 alerts in history
        if len(self.alert_history) > 1000:
            self.alert_history = self.alert_history[-1000:]

        # Send notifications
        tasks = []

        if self.slack_webhook_url:
            tasks.append(self._send_slack_alert(alert))

        if self.email_config:
            tasks.append(self._send_email_alert(alert))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # Log alert
        logger.warning(
            f"Alert triggered: {alert.name}",
            extra_fields={
                'severity': alert.severity,
                'message': alert.message,
                'details': alert.details
            }
        )

    def _is_duplicate_alert(self, alert: Alert) -> bool:
        """Check if alert is a duplicate of recent alert."""
        if alert.name not in self.active_alerts:
            return False

        last_alert = self.active_alerts[alert.name]
        time_diff = alert.timestamp - last_alert.timestamp

        # Suppress duplicates within 5 minutes
        return time_diff < timedelta(minutes=5)

    async def _send_slack_alert(self, alert: Alert) -> None:
        """Send alert to Slack."""
        if not self.slack_webhook_url:
            return

        try:
            # Format Slack message
            color = {
                'critical': '#FF0000',
                'warning': '#FFA500',
                'info': '#0000FF'
            }.get(alert.severity, '#808080')

            message = {
                'attachments': [{
                    'color': color,
                    'title': f'🚨 InnoSynth Alert: {alert.name}',
                    'text': alert.message,
                    'fields': [
                        {
                            'title': 'Severity',
                            'value': alert.severity.upper(),
                            'short': True
                        },
                        {
                            'title': 'Timestamp',
                            'value': alert.timestamp.isoformat(),
                            'short': True
                        }
                    ] + [
                        {
                            'title': key,
                            'value': str(value),
                            'short': True
                        }
                        for key, value in alert.details.items()
                    ],
                    'footer': 'InnoSynth.ai Monitoring',
                    'ts': int(alert.timestamp.timestamp())
                }]
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.slack_webhook_url,
                    json=message,
                    timeout=5.0
                )
                response.raise_for_status()

            logger.info(f"Slack alert sent for {alert.name}")

        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e!s}")

    async def _send_email_alert(self, alert: Alert) -> None:
        """Send alert via email."""
        # TODO: Implement email sending
        # This would require SMTP configuration
        logger.info(f"Email alert would be sent for {alert.name}")

    def get_active_alerts(self) -> list[Alert]:
        """Get list of currently active alerts."""
        return list(self.active_alerts.values())

    def clear_alert(self, alert_name: str) -> None:
        """Clear an active alert."""
        if alert_name in self.active_alerts:
            del self.active_alerts[alert_name]
            logger.info(f"Alert cleared: {alert_name}")

    def add_rule(self, rule: AlertRule) -> None:
        """Add a new alert rule."""
        self.rules.append(rule)
        logger.info(f"Alert rule added: {rule.name}")

    def disable_rule(self, rule_name: str) -> None:
        """Disable an alert rule."""
        for rule in self.rules:
            if rule.name == rule_name:
                rule.enabled = False
                logger.info(f"Alert rule disabled: {rule_name}")
                break

    def enable_rule(self, rule_name: str) -> None:
        """Enable an alert rule."""
        for rule in self.rules:
            if rule.name == rule_name:
                rule.enabled = True
                logger.info(f"Alert rule enabled: {rule_name}")
                break


# Singleton instance
alert_manager = AlertManager()
