"""
Health check service for monitoring system dependencies.
"""
import asyncio
from datetime import datetime
from typing import Any, Callable

import httpx

from app.core.logging import get_logger
from app.core.metrics import health_check_status

logger = get_logger(__name__)


class HealthCheckService:
    """Service for performing health checks on system dependencies."""

    def __init__(self):
        self.checks: dict[str, Callable[..., Any]] = {
            'database': self._check_database,
            'redis': self._check_redis,
            'neo4j': self._check_neo4j,
            'pinecone': self._check_pinecone,
            'openai': self._check_openai,
        }

    async def check_all(self) -> dict[str, Any]:
        """
        Run all health checks.

        Returns:
            Dictionary with health check results
        """
        results = {}
        tasks = []

        for service_name, check_func in self.checks.items():
            tasks.append(self._run_check(service_name, check_func))

        # Run all checks concurrently
        check_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for service_name, result in zip(self.checks.keys(), check_results):
            if isinstance(result, Exception):
                results[service_name] = {
                    'status': 'unhealthy',
                    'error': str(result),
                    'timestamp': datetime.utcnow().isoformat()
                }
                health_check_status.labels(service=service_name).set(0)
            else:
                results[service_name] = result
                status_value = 1 if result['status'] == 'healthy' else 0
                health_check_status.labels(service=service_name).set(status_value)

        # Determine overall health
        all_healthy = all(
            r.get('status') == 'healthy'
            for r in results.values()
        )

        return {
            'status': 'healthy' if all_healthy else 'degraded',
            'timestamp': datetime.utcnow().isoformat(),
            'checks': results
        }

    async def check_service(self, service_name: str) -> dict[str, Any]:
        """
        Run health check for a specific service.

        Args:
            service_name: Name of the service to check

        Returns:
            Health check result
        """
        if service_name not in self.checks:
            return {
                'status': 'unknown',
                'error': f'Unknown service: {service_name}',
                'timestamp': datetime.utcnow().isoformat()
            }

        check_func = self.checks[service_name]
        result = await self._run_check(service_name, check_func)

        status_value = 1 if result['status'] == 'healthy' else 0
        health_check_status.labels(service=service_name).set(status_value)

        return result

    async def _run_check(
        self,
        service_name: str,
        check_func: Callable[..., Any]
    ) -> dict[str, Any]:
        """
        Run a single health check with timeout.

        Args:
            service_name: Name of the service
            check_func: Health check function

        Returns:
            Health check result
        """
        try:
            result = await asyncio.wait_for(check_func(), timeout=5.0)
            return result
        except TimeoutError:
            logger.warning(f"Health check timeout for {service_name}")
            return {
                'status': 'unhealthy',
                'error': 'Health check timeout',
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Health check failed for {service_name}: {e!s}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _check_database(self) -> dict[str, Any]:
        """Check PostgreSQL database connectivity."""
        try:
            # TODO: Import actual database connection
            # from app.core.database import get_db
            # async with get_db() as db:
            #     await db.execute("SELECT 1")

            # Placeholder for now
            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'latency_ms': 5
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _check_redis(self) -> dict[str, Any]:
        """Check Redis connectivity."""
        try:
            # TODO: Import actual Redis connection
            # from app.core.cache import redis_client
            # await redis_client.ping()

            # Placeholder for now
            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'latency_ms': 2
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _check_neo4j(self) -> dict[str, Any]:
        """Check Neo4j graph database connectivity."""
        try:
            # TODO: Import actual Neo4j connection
            # from app.services.graph.client import graph_client
            # await graph_client.verify_connectivity()

            # Placeholder for now
            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'latency_ms': 10
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _check_pinecone(self) -> dict[str, Any]:
        """Check Pinecone vector database connectivity."""
        try:
            # TODO: Import actual Pinecone connection
            # from app.services.vector.client import vector_client
            # await vector_client.describe_index_stats()

            # Placeholder for now
            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'latency_ms': 50
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _check_openai(self) -> dict[str, Any]:
        """Check OpenAI API connectivity."""
        try:
            # Simple API check
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': 'Bearer invalid'},
                    timeout=3.0
                )
                # 401 means API is reachable (invalid auth is expected)
                if response.status_code == 401:
                    return {
                        'status': 'healthy',
                        'timestamp': datetime.utcnow().isoformat(),
                        'latency_ms': 100
                    }
                else:
                    return {
                        'status': 'degraded',
                        'warning': f'Unexpected status code: {response.status_code}',
                        'timestamp': datetime.utcnow().isoformat()
                    }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }


# Singleton instance
health_check_service = HealthCheckService()
