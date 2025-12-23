"""
FastAPI application entry point
"""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from slowapi.errors import RateLimitExceeded

from app.config import settings

# Initialize Sentry error tracking
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1 if settings.DEBUG else 0.05,
        environment=settings.ENVIRONMENT,
        release=f"innosynth-backend@{settings.APP_VERSION}",
        send_default_pii=False,
        attach_stacktrace=True,
    )
    logging.getLogger(__name__).info("Sentry error tracking initialized")
from app.database import close_db, init_db
from app.middleware.rate_limiter import limiter, rate_limit_exceeded_handler
from app.middleware.security import (
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.routers import (
    admin,
    auth,
    decisions,
    documents_local,
    health,
    integrations,
    knowledge_health_local,
    oauth,
    query,
    query_local,
    superadmin,
)
from app.services.ingestion.pipeline import IngestionPipeline
from app.workers.health_worker import start_health_worker, stop_health_worker
from app.workers.sync_worker import init_sync_worker, sync_worker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    await init_db()

    # Initialize and start background workers
    try:
        # Check if required API keys are configured for sync worker
        if settings.PINECONE_API_KEY and settings.OPENAI_API_KEY:
            # Initialize sync worker with ingestion pipeline
            pipeline = IngestionPipeline(
                openai_api_key=settings.OPENAI_API_KEY,
                pinecone_api_key=settings.PINECONE_API_KEY,
                pinecone_environment=settings.PINECONE_ENVIRONMENT,
                pinecone_index_name=settings.PINECONE_INDEX,
                neo4j_uri=settings.NEO4J_URI,
                neo4j_username=settings.NEO4J_USER,
                neo4j_password=settings.NEO4J_PASSWORD,
                embedding_model=settings.EMBEDDING_MODEL,
            )
            worker = init_sync_worker(pipeline)
            await worker.start()
            logger.info("Sync worker started")
        else:
            logger.info("Sync worker disabled - PINECONE_API_KEY or OPENAI_API_KEY not configured")

        # Start health worker (doesn't require external API keys)
        await start_health_worker()
        logger.info("Health worker started")
    except Exception as e:
        logger.warning(f"Failed to start background workers: {e}")
        # Continue without workers - app still functional

    yield

    # Shutdown
    try:
        # Stop health worker
        await stop_health_worker()
        logger.info("Health worker stopped")

        # Stop sync worker
        if sync_worker:
            await sync_worker.stop()
            logger.info("Sync worker stopped")
    except Exception as e:
        logger.warning(f"Error stopping background workers: {e}")

    await close_db()


app = FastAPI(
    title="InnoSynth.ai API",
    description="Enterprise Knowledge Synthesis Platform",
    version="0.1.0",
    lifespan=lifespan
)

# Add rate limiter state to app
app.state.limiter = limiter

# Add rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Security middleware (order matters - outermost first)
# 1. Request size limit - reject oversized requests early
app.add_middleware(RequestSizeLimitMiddleware)

# 2. Security headers - add to all responses
app.add_middleware(SecurityHeadersMiddleware)

# 3. CORS configuration - must be after security headers
# Lock down origins in production
allowed_origins = settings.CORS_ORIGINS
if not settings.DEBUG:
    # In production, only allow specific origins
    # Remove wildcard and localhost if present
    allowed_origins = [
        origin for origin in allowed_origins
        if origin not in ["*", "http://localhost:3000", "http://localhost:5173"]
    ]
    # Ensure at least the production frontend is allowed
    if not allowed_origins:
        allowed_origins = settings.CORS_ORIGINS  # Fall back to configured origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-CSRF-Token",
        "X-Requested-With",
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(query.router, prefix="/api", tags=["query"])
app.include_router(oauth.router, prefix="/api", tags=["oauth"])
app.include_router(documents_local.router, tags=["documents"])
app.include_router(knowledge_health_local.router, tags=["knowledge-health"])
app.include_router(query_local.router, tags=["query-local"])
app.include_router(admin.router, tags=["admin"])
app.include_router(superadmin.router, tags=["superadmin"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])
app.include_router(decisions.router, tags=["decisions"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "InnoSynth.ai API",
        "version": "0.1.0",
        "status": "operational"
    }
