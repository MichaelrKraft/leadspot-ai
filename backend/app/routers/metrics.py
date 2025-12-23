"""
Metrics and health check endpoints.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.core.logging import get_logger
from app.services.monitoring import health_check_service

logger = get_logger(__name__)
router = APIRouter()


@router.get('/metrics', response_class=PlainTextResponse)
async def metrics() -> PlainTextResponse:
    """
    Prometheus metrics endpoint.

    Returns:
        Metrics in Prometheus format
    """
    return PlainTextResponse(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


@router.get('/api/internal/health')
async def health_check() -> JSONResponse:
    """
    Detailed health check endpoint.

    Returns:
        Health status of all services
    """
    health_status = await health_check_service.check_all()

    status_code = 200 if health_status['status'] == 'healthy' else 503

    return JSONResponse(
        content=health_status,
        status_code=status_code
    )


@router.get('/api/internal/health/{service_name}')
async def health_check_service_endpoint(service_name: str) -> JSONResponse:
    """
    Health check for specific service.

    Args:
        service_name: Name of service to check

    Returns:
        Health status of the service
    """
    health_status = await health_check_service.check_service(service_name)

    status_code = 200 if health_status['status'] == 'healthy' else 503

    return JSONResponse(
        content=health_status,
        status_code=status_code
    )


@router.get('/health')
async def simple_health_check() -> dict[str, str]:
    """
    Simple health check endpoint for load balancers.

    Returns:
        Basic health status
    """
    return {'status': 'ok'}


@router.get('/api/internal/ready')
async def readiness_check() -> JSONResponse:
    """
    Readiness check for Kubernetes.

    Returns:
        Readiness status
    """
    # Check critical services only
    critical_services = ['database', 'redis']

    results = {}
    for service in critical_services:
        result = await health_check_service.check_service(service)
        results[service] = result['status']

    all_ready = all(status == 'healthy' for status in results.values())

    return JSONResponse(
        content={
            'ready': all_ready,
            'services': results
        },
        status_code=200 if all_ready else 503
    )


@router.get('/api/internal/live')
async def liveness_check() -> dict[str, str]:
    """
    Liveness check for Kubernetes.

    Returns:
        Liveness status
    """
    return {'status': 'alive'}
