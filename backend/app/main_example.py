"""
Example FastAPI application setup with monitoring infrastructure.

This file demonstrates how to integrate all monitoring components
into your main FastAPI application.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

# Logging setup
from app.core.logging import get_logger, setup_logging
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.middleware.metrics import MetricsMiddleware

# Middleware
from app.middleware.request_id import RequestIDMiddleware

# Routers
from app.routers import metrics

# Initialize logger
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting InnoSynth.ai application")
    yield
    # Shutdown
    logger.info("Shutting down InnoSynth.ai application")


def create_app() -> FastAPI:
    """
    Create and configure FastAPI application with monitoring.

    Returns:
        Configured FastAPI application
    """
    # Setup structured logging first
    setup_logging(log_level="INFO")

    # Create FastAPI app
    app = FastAPI(
        title="InnoSynth.ai",
        description="Enterprise Knowledge Synthesis Platform",
        version="1.0.0",
        lifespan=lifespan
    )

    # Add middleware in correct order (IMPORTANT!)
    # Order matters: Error handler → Metrics → Request ID
    app.add_middleware(
        ErrorHandlerMiddleware,
        debug=False  # Set to True for development
    )
    app.add_middleware(MetricsMiddleware)
    app.add_middleware(RequestIDMiddleware)

    # Include monitoring router
    app.include_router(metrics.router, tags=["monitoring"])

    # Example: Include your other routers
    # from app.routers import auth, search, synthesis
    # app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    # app.include_router(search.router, prefix="/api/search", tags=["search"])
    # app.include_router(synthesis.router, prefix="/api/synthesis", tags=["synthesis"])

    # Example route demonstrating exception handling
    @app.get("/api/example")
    async def example_route(request: Request):
        """Example route showing monitoring integration."""
        from app.middleware.request_id import get_request_id

        # Request ID is automatically available
        request_id = get_request_id(request)

        # You can also manually set additional context
        # set_request_context(user_id="user-123")

        logger.info(
            "Processing example request",
            extra_fields={
                "request_id": request_id,
                "path": request.url.path
            }
        )

        return {"message": "Hello from InnoSynth.ai", "request_id": request_id}

    # Example route demonstrating custom exceptions
    @app.get("/api/example-error")
    async def example_error():
        """Example route showing custom exception."""
        from app.core.exceptions import NotFoundError

        raise NotFoundError(
            resource="KnowledgeGraph",
            identifier="kg-123"
        )

    # Example route demonstrating custom metrics
    @app.post("/api/example-metrics")
    async def example_metrics():
        """Example route showing custom metrics."""
        import time

        from app.core.metrics import query_duration_seconds, query_total, synthesis_operations_total

        # Record custom business metrics
        start_time = time.time()

        # Simulate some work
        time.sleep(0.1)

        # Record metrics
        duration = time.time() - start_time
        query_total.labels(query_type="synthesis", status="success").inc()
        query_duration_seconds.labels(
            query_type="synthesis",
            status="success"
        ).observe(duration)
        synthesis_operations_total.labels(
            operation_type="graph_synthesis",
            status="success"
        ).inc()

        return {"message": "Metrics recorded", "duration": duration}

    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main_example:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=None  # Use our custom logging
    )
