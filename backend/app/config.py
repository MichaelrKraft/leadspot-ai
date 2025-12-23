"""
Application configuration using Pydantic settings

SECURITY NOTE: Never commit .env files with real secrets.
All secrets should be provided via environment variables in production.
"""

import secrets
import sys

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Environment
    ENVIRONMENT: str = "development"  # development, staging, production

    # Application
    APP_NAME: str = "LeadSpot.ai"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # Error Tracking (Sentry)
    SENTRY_DSN: str = ""  # Optional - set to enable error tracking

    # CORS - comma-separated origins in env, parsed to list
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS from comma-separated string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database (PostgreSQL) - NO DEFAULT for production safety
    DATABASE_URL: str = ""

    # Graph Database (Neo4j)
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = ""  # Required in production

    # Vector Database (Pinecone)
    PINECONE_API_KEY: str = ""
    PINECONE_ENVIRONMENT: str = "us-east-1-aws"
    PINECONE_INDEX: str = "leadspot-embeddings"

    # Cache (Redis)
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI APIs
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Authentication - CRITICAL: Must be set in production
    JWT_SECRET: str = ""  # REQUIRED - no default for security
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60  # 1 hour for access token
    JWT_REFRESH_EXPIRE_DAYS: int = 7  # 7 days for refresh token

    # OAuth (Google)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # OAuth (Microsoft)
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""

    # OAuth (Slack)
    SLACK_CLIENT_ID: str = ""
    SLACK_CLIENT_SECRET: str = ""

    # OAuth (Salesforce)
    SALESFORCE_CLIENT_ID: str = ""
    SALESFORCE_CLIENT_SECRET: str = ""
    SALESFORCE_INSTANCE_URL: str = "https://login.salesforce.com"

    # OAuth General
    API_BASE_URL: str = "http://localhost:8000"
    ENCRYPTION_KEY: str = ""

    # Embedding settings
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536

    # Synthesis settings
    SYNTHESIS_MODEL: str = "claude-3-5-sonnet-20241022"
    MAX_SOURCES: int = 10

    # Query settings
    QUERY_TIMEOUT_SECONDS: int = 30
    MAX_QUERY_LENGTH: int = 500

    # Health monitoring settings
    HEALTH_SCAN_INTERVAL_HOURS: int = 48

    # File storage
    UPLOAD_DIR: str = "./uploads"

    # Frontend URL (for OAuth redirects)
    FRONTEND_URL: str = "http://localhost:3000"

    def validate_production_settings(self) -> list[str]:
        """
        Validate that all required settings are properly configured for production.
        Returns a list of error messages for any missing/insecure settings.
        """
        errors = []

        # JWT Secret validation
        if not self.JWT_SECRET:
            errors.append("JWT_SECRET is required but not set")
        elif len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be at least 32 characters for security")
        elif self.JWT_SECRET in [
            "your-secret-key-change-in-production",
            "secret",
            "changeme",
            "password",
        ]:
            errors.append("JWT_SECRET is using an insecure default value")

        # Database URL validation
        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required but not set")

        # Production-specific validations
        if self.ENVIRONMENT == "production":
            # No localhost in CORS
            for origin in self.CORS_ORIGINS:
                if "localhost" in origin or "127.0.0.1" in origin:
                    errors.append(f"CORS_ORIGINS contains localhost in production: {origin}")

            # Require Neo4j password
            if not self.NEO4J_PASSWORD:
                errors.append("NEO4J_PASSWORD is required in production")

            # Require encryption key for OAuth tokens
            if not self.ENCRYPTION_KEY:
                errors.append("ENCRYPTION_KEY is required in production for OAuth token encryption")

            # Debug should be off
            if self.DEBUG:
                errors.append("DEBUG should be False in production")

        return errors


def _get_settings() -> Settings:
    """
    Create and validate settings.
    In development, generates a random JWT_SECRET if not provided.
    In production, fails fast if critical settings are missing.
    """
    settings = Settings()

    # Development mode: auto-generate JWT_SECRET if not provided
    if settings.ENVIRONMENT == "development":
        if not settings.JWT_SECRET:
            # Generate a secure random secret for development
            settings.JWT_SECRET = secrets.token_urlsafe(32)
            print("WARNING: Generated random JWT_SECRET for development. Set JWT_SECRET in .env for persistence.")

        if not settings.DATABASE_URL:
            # Use SQLite for development if no DATABASE_URL
            settings.DATABASE_URL = "sqlite+aiosqlite:///./leadspot.db"

    # Validate settings
    errors = settings.validate_production_settings()

    if errors:
        if settings.ENVIRONMENT == "production":
            # In production, fail fast on configuration errors
            print("FATAL: Configuration errors detected:", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
            sys.exit(1)
        else:
            # In development, just warn
            print("WARNING: Configuration issues detected:")
            for error in errors:
                print(f"  - {error}")

    return settings


settings = _get_settings()
