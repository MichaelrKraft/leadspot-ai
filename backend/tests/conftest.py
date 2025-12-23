"""
Pytest configuration and fixtures for InnoSynth.ai backend tests.

This module provides:
- Test database setup (SQLite in-memory)
- FastAPI test client
- Mock services for external dependencies
- Authentication fixtures
"""

import asyncio
from collections.abc import AsyncGenerator, Generator
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.services.auth_service import hash_password, create_access_token


# ============================================================================
# Event Loop Configuration
# ============================================================================

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Database Fixtures
# ============================================================================

# Test database URL (SQLite in-memory for speed)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create async test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def override_get_db(db_session: AsyncSession):
    """Override the get_db dependency for testing."""
    async def _override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


# ============================================================================
# HTTP Client Fixtures
# ============================================================================

@pytest.fixture(scope="function")
def client(override_get_db) -> Generator[TestClient, None, None]:
    """Create a synchronous test client."""
    with TestClient(app) as test_client:
        yield test_client


@pytest_asyncio.fixture(scope="function")
async def async_client(override_get_db) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest.fixture
def test_user_data() -> dict[str, Any]:
    """Standard test user data."""
    return {
        "email": "test@example.com",
        "password": "SecurePassword123!",
        "name": "Test User",
        "organization_id": str(uuid4()),
        "organization_domain": "example.com",
    }


@pytest.fixture
def test_admin_data() -> dict[str, Any]:
    """Test admin user data."""
    return {
        "email": "admin@example.com",
        "password": "AdminPassword123!",
        "name": "Admin User",
        "organization_id": str(uuid4()),
        "organization_domain": "example.com",
        "role": "admin",
    }


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_user_data: dict) -> User:
    """Create a test user in the database."""
    from app.services.auth_service import hash_password

    user = User(
        user_id=str(uuid4()),
        email=test_user_data["email"],
        hashed_password=hash_password(test_user_data["password"]),
        name=test_user_data["name"],
        organization_id=test_user_data["organization_id"],
        role="user",
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user_data: dict) -> dict[str, str]:
    """Generate auth headers with a valid JWT token."""
    from uuid import UUID
    from app.services.auth_service import create_access_token

    token = create_access_token(
        user_id=UUID(test_user_data["organization_id"]),  # Use org_id as user_id for test
        email=test_user_data["email"],
        organization_id=UUID(test_user_data["organization_id"]),
        role="user",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(test_admin_data: dict) -> dict[str, str]:
    """Generate auth headers for admin user."""
    from uuid import UUID
    from app.services.auth_service import create_access_token

    token = create_access_token(
        user_id=UUID(test_admin_data["organization_id"]),  # Use org_id as user_id for test
        email=test_admin_data["email"],
        organization_id=UUID(test_admin_data["organization_id"]),
        role="admin",
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# Mock Service Fixtures
# ============================================================================

@pytest.fixture
def mock_anthropic():
    """Mock Anthropic Claude API."""
    with patch("app.services.query_pipeline.anthropic.Anthropic") as mock:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(text="Mock AI response")],
            usage=MagicMock(input_tokens=100, output_tokens=50),
        )
        mock.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_openai():
    """Mock OpenAI API for embeddings."""
    with patch("app.services.embedding_service.openai.OpenAI") as mock:
        mock_client = MagicMock()
        mock_client.embeddings.create.return_value = MagicMock(
            data=[MagicMock(embedding=[0.1] * 1536)]
        )
        mock.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_pinecone():
    """Mock Pinecone vector database."""
    with patch("app.services.vector_service.Pinecone") as mock:
        mock_index = MagicMock()
        mock_index.query.return_value = MagicMock(
            matches=[
                MagicMock(id="doc1", score=0.95, metadata={"text": "Test document"}),
            ]
        )
        mock_index.upsert.return_value = MagicMock(upserted_count=1)
        mock.return_value.Index.return_value = mock_index
        yield mock_index


@pytest.fixture
def mock_neo4j():
    """Mock Neo4j graph database."""
    with patch("app.services.neo4j_service.AsyncGraphDatabase") as mock:
        mock_driver = AsyncMock()
        mock_session = AsyncMock()
        mock_session.run.return_value = AsyncMock(
            data=lambda: [{"n": {"id": "1", "title": "Test Decision"}}]
        )
        mock_driver.session.return_value.__aenter__.return_value = mock_session
        mock.driver.return_value = mock_driver
        yield mock_driver


@pytest.fixture
def mock_redis():
    """Mock Redis cache."""
    with patch("app.services.cache_service.redis.Redis") as mock:
        mock_client = MagicMock()
        mock_client.get.return_value = None
        mock_client.set.return_value = True
        mock_client.delete.return_value = 1
        mock.return_value = mock_client
        yield mock_client


# ============================================================================
# Utility Fixtures
# ============================================================================

@pytest.fixture
def sample_document() -> dict[str, Any]:
    """Sample document data for testing."""
    return {
        "title": "Test Document",
        "content": "This is a test document with some content for testing purposes.",
        "source": "test",
        "metadata": {
            "author": "Test Author",
            "created_at": datetime.utcnow().isoformat(),
        },
    }


@pytest.fixture
def sample_query() -> dict[str, str]:
    """Sample query data for testing."""
    return {
        "query": "What is the test document about?",
    }


@pytest.fixture
def sample_decision() -> dict[str, Any]:
    """Sample decision data for testing."""
    return {
        "title": "Test Decision",
        "description": "A test decision for the decision archaeology feature.",
        "category": "strategic",
        "decision_date": datetime.utcnow().isoformat(),
        "context": {
            "background": "Test background",
            "stakeholders": ["Test User"],
        },
    }
