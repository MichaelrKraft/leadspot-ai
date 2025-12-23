"""Background worker for automated health scanning."""

import asyncio
import logging
from datetime import datetime

from app.config import settings
from app.database import async_session_maker
from app.services.health import AlertService, HealthScanner, HealthScorer

logger = logging.getLogger(__name__)


class HealthWorker:
    """Background worker for automated knowledge health scanning."""

    def __init__(self):
        # Initialize services
        self.alert_service = AlertService()
        self.health_scanner = HealthScanner(self.alert_service)
        self.health_scorer = HealthScorer()

        # Worker configuration - uses settings or default 48h (2 days)
        self.scan_interval_hours = settings.HEALTH_SCAN_INTERVAL_HOURS
        self.is_running = False
        self.current_task: asyncio.Task | None = None

    async def start(self):
        """Start the background worker."""
        if self.is_running:
            logger.warning("Health worker is already running")
            return

        self.is_running = True
        logger.info(f"Starting health worker (scan interval: {self.scan_interval_hours}h)")

        # Start the background task
        self.current_task = asyncio.create_task(self._run_worker_loop())

    async def stop(self):
        """Stop the background worker."""
        if not self.is_running:
            logger.warning("Health worker is not running")
            return

        self.is_running = False
        logger.info("Stopping health worker...")

        # Cancel the current task
        if self.current_task:
            self.current_task.cancel()
            try:
                await self.current_task
            except asyncio.CancelledError:
                logger.info("Health worker task cancelled")

        logger.info("Health worker stopped")

    async def _run_worker_loop(self):
        """Main worker loop that runs health scans periodically."""
        logger.info("Health worker loop started")

        while self.is_running:
            try:
                # Run health scan for all organizations
                await self._scan_all_organizations()

                # Auto-maintenance tasks
                await self._run_maintenance_tasks()

                # Wait for next scan interval
                scan_interval_seconds = self.scan_interval_hours * 3600
                logger.info(f"Next health scan in {self.scan_interval_hours} hours")
                await asyncio.sleep(scan_interval_seconds)

            except asyncio.CancelledError:
                logger.info("Worker loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in health worker loop: {e}", exc_info=True)
                # Wait a bit before retrying on error
                await asyncio.sleep(300)  # 5 minutes

    async def _scan_all_organizations(self):
        """Run health scans for all organizations."""
        logger.info("Starting health scans for all organizations")

        try:
            org_ids = await self._get_all_organization_ids()

            for org_id in org_ids:
                try:
                    await self.scan_organization(org_id)
                except Exception as e:
                    logger.error(f"Error scanning org {org_id}: {e}", exc_info=True)
                    # Continue with next org even if one fails

            logger.info(f"Completed health scans for {len(org_ids)} organizations")

        except Exception as e:
            logger.error(f"Error in scan_all_organizations: {e}", exc_info=True)

    async def scan_organization(self, org_id: str) -> dict:
        """
        Run comprehensive health scan for a single organization.

        Args:
            org_id: Organization ID

        Returns:
            Scan results dictionary
        """
        logger.info(f"Starting health scan for org {org_id}")
        started_at = datetime.utcnow()

        try:
            # Get database session
            async with async_session_maker() as db:
                # Run full scan using HealthScanner
                scan_results = await self.health_scanner.scan_all(org_id, db)

                # Get current alerts for health score calculation
                alerts = await self.alert_service.get_alerts(org_id, status="active")

                # Calculate health score
                conflicts = [a for a in alerts if a.get("type") == "conflict"]
                outdated = [a for a in alerts if a.get("type") == "outdated"]
                gaps = [a for a in alerts if a.get("type") == "knowledge_gap"]

                health_score = await self.health_scorer.calculate_health_score(
                    org_id=org_id,
                    conflicts=conflicts,
                    outdated_docs=outdated,
                    gaps=gaps,
                    total_docs=50,  # TODO: Get from database
                    total_queries=100,
                    successful_queries=85,
                    avg_doc_age_days=120.0
                )

            completed_at = datetime.utcnow()
            scan_duration = (completed_at - started_at).total_seconds()

            result = {
                "org_id": org_id,
                "status": "completed",
                "alerts_created": scan_results.get("alerts_created", 0),
                "conflicts_detected": scan_results.get("conflicts_detected", 0),
                "outdated_detected": scan_results.get("outdated_detected", 0),
                "health_score": health_score["overall_score"],
                "health_status": health_score["health_status"],
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_seconds": scan_duration
            }

            logger.info(
                f"Health scan completed for org {org_id}: "
                f"{result['alerts_created']} alerts, score {health_score['overall_score']:.1f} "
                f"({health_score['health_status']}) in {scan_duration:.1f}s"
            )

            return result

        except Exception as e:
            logger.error(f"Error scanning organization {org_id}: {e}", exc_info=True)
            return {
                "org_id": org_id,
                "status": "failed",
                "error": str(e),
                "started_at": started_at.isoformat(),
                "completed_at": datetime.utcnow().isoformat()
            }

    async def _run_maintenance_tasks(self):
        """Run periodic maintenance tasks."""
        logger.info("Running health system maintenance tasks")

        try:
            org_ids = await self._get_all_organization_ids()

            for org_id in org_ids:
                try:
                    # Auto-resolve stale alerts (30 days)
                    resolved = await self.alert_service.auto_resolve_stale_alerts(org_id, days=30)
                    if resolved > 0:
                        logger.info(f"Auto-resolved {resolved} stale alerts for org {org_id}")

                    # Clear old resolved alerts (90 days)
                    cleared = await self.alert_service.clear_resolved_alerts(org_id, days=90)
                    if cleared > 0:
                        logger.info(f"Cleared {cleared} old alerts for org {org_id}")

                except Exception as e:
                    logger.error(f"Error in maintenance for org {org_id}: {e}", exc_info=True)

            logger.info("Maintenance tasks completed")

        except Exception as e:
            logger.error(f"Error running maintenance tasks: {e}", exc_info=True)

    async def _get_all_organization_ids(self) -> list[str]:
        """
        Get all organization IDs from database.

        Returns:
            List of organization IDs
        """
        # TODO: Implement database query to get real org IDs
        # For now, return demo data
        return ["org_demo_001"]

    async def scan_on_demand(self, org_id: str) -> dict:
        """
        Run an on-demand health scan for an organization.

        Args:
            org_id: Organization ID

        Returns:
            Scan results dictionary
        """
        logger.info(f"Running on-demand scan for org {org_id}")
        return await self.scan_organization(org_id)


# Global worker instance
health_worker = HealthWorker()


async def start_health_worker():
    """Start the global health worker."""
    await health_worker.start()


async def stop_health_worker():
    """Stop the global health worker."""
    await health_worker.stop()
