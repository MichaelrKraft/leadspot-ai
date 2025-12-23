"""Detect outdated and stale documents in knowledge base."""

import logging
from datetime import datetime

from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


class OutdatedDetector:
    """Detects outdated and stale documents based on various signals."""

    def __init__(self, vector_service: VectorService):
        self.vector_service = vector_service

        # Configurable thresholds
        self.age_threshold_days = 180  # 6 months
        self.staleness_threshold_days = 90  # 3 months since last update
        self.low_usage_threshold = 5  # queries in last 30 days

    async def detect_outdated(self, org_id: str) -> list[dict]:
        """
        Find potentially outdated documents.

        Args:
            org_id: Organization ID

        Returns:
            List of outdated document alerts
        """
        logger.info(f"Starting outdated detection for org {org_id}")
        outdated_docs = []

        try:
            # Get all documents for organization
            all_docs = await self.vector_service.get_all_documents(org_id)

            current_time = datetime.utcnow()

            for doc in all_docs:
                metadata = doc.get("metadata", {})
                doc_id = doc.get("id")

                # Check multiple staleness signals
                alerts = []

                # 1. Age-based staleness
                created_at = self._parse_datetime(metadata.get("created_at"))
                if created_at:
                    age_days = (current_time - created_at).days
                    if age_days > self.age_threshold_days:
                        alerts.append({
                            "signal": "age",
                            "value": age_days,
                            "threshold": self.age_threshold_days,
                            "message": f"Document is {age_days} days old"
                        })

                # 2. Last update staleness
                updated_at = self._parse_datetime(metadata.get("updated_at"))
                if updated_at:
                    staleness_days = (current_time - updated_at).days
                    if staleness_days > self.staleness_threshold_days:
                        alerts.append({
                            "signal": "staleness",
                            "value": staleness_days,
                            "threshold": self.staleness_threshold_days,
                            "message": f"Not updated in {staleness_days} days"
                        })

                # 3. Low usage indicator
                query_count = metadata.get("query_count_30d", 0)
                if query_count < self.low_usage_threshold:
                    alerts.append({
                        "signal": "low_usage",
                        "value": query_count,
                        "threshold": self.low_usage_threshold,
                        "message": f"Only {query_count} queries in last 30 days"
                    })

                # 4. Time-sensitive content detection
                if self._contains_time_sensitive_keywords(doc.get("content", "")):
                    alerts.append({
                        "signal": "time_sensitive",
                        "value": True,
                        "threshold": None,
                        "message": "Contains time-sensitive information"
                    })

                # If any alerts, add to outdated list
                if alerts:
                    severity = self._calculate_outdated_severity(alerts)
                    outdated_docs.append({
                        "type": "outdated",
                        "severity": severity,
                        "doc_id": doc_id,
                        "title": metadata.get("title", "Untitled"),
                        "description": self._generate_outdated_description(alerts),
                        "signals": alerts,
                        "detected_at": current_time.isoformat(),
                        "status": "active",
                        "metadata": {
                            "created_at": metadata.get("created_at"),
                            "updated_at": metadata.get("updated_at"),
                            "query_count_30d": query_count
                        }
                    })

            logger.info(f"Detected {len(outdated_docs)} outdated documents for org {org_id}")
            return outdated_docs

        except Exception as e:
            logger.error(f"Error detecting outdated documents for org {org_id}: {e}", exc_info=True)
            return outdated_docs

    def _parse_datetime(self, date_str: str | None) -> datetime | None:
        """Parse datetime string safely."""
        if not date_str:
            return None

        try:
            # Try ISO format
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            try:
                # Try common format
                return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            except (ValueError, AttributeError):
                return None

    def _contains_time_sensitive_keywords(self, content: str) -> bool:
        """
        Check if content contains time-sensitive keywords.

        Args:
            content: Document content

        Returns:
            True if time-sensitive keywords found
        """
        time_sensitive_keywords = [
            "2024", "2025", "Q1", "Q2", "Q3", "Q4",
            "current quarter", "this year", "fiscal year",
            "expires", "deadline", "temporary", "interim",
            "effective until", "valid through", "as of"
        ]

        content_lower = content.lower()
        return any(keyword.lower() in content_lower for keyword in time_sensitive_keywords)

    def _calculate_outdated_severity(self, alerts: list[dict]) -> str:
        """
        Calculate severity based on staleness signals.

        Args:
            alerts: List of alert dictionaries

        Returns:
            Severity level: high, medium, or low
        """
        # High severity if multiple signals or critical signal
        if len(alerts) >= 3:
            return "high"

        # Check for time-sensitive content
        has_time_sensitive = any(a.get("signal") == "time_sensitive" for a in alerts)
        if has_time_sensitive:
            return "high"

        # Check age thresholds
        for alert in alerts:
            if alert.get("signal") == "age":
                age_days = alert.get("value", 0)
                if age_days > 365:  # Over 1 year
                    return "high"
                elif age_days > 270:  # Over 9 months
                    return "medium"

            if alert.get("signal") == "staleness":
                staleness_days = alert.get("value", 0)
                if staleness_days > 180:  # Over 6 months
                    return "high"
                elif staleness_days > 120:  # Over 4 months
                    return "medium"

        return "low"

    def _generate_outdated_description(self, alerts: list[dict]) -> str:
        """
        Generate human-readable description of why document is outdated.

        Args:
            alerts: List of alert dictionaries

        Returns:
            Description string
        """
        messages = [alert.get("message", "") for alert in alerts if alert.get("message")]

        if not messages:
            return "Document may be outdated"

        # Combine messages
        if len(messages) == 1:
            return messages[0]
        elif len(messages) == 2:
            return f"{messages[0]} and {messages[1]}"
        else:
            return f"{', '.join(messages[:-1])}, and {messages[-1]}"

    async def suggest_review_priority(self, org_id: str) -> list[dict]:
        """
        Get prioritized list of documents for review.

        Args:
            org_id: Organization ID

        Returns:
            Sorted list of documents by review priority
        """
        outdated_docs = await self.detect_outdated(org_id)

        # Sort by severity (high > medium > low) and then by staleness
        severity_order = {"high": 3, "medium": 2, "low": 1}

        sorted_docs = sorted(
            outdated_docs,
            key=lambda x: (
                severity_order.get(x.get("severity", "low"), 0),
                -len(x.get("signals", []))
            ),
            reverse=True
        )

        return sorted_docs
