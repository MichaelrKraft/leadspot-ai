# InnoSynth Testing - Quick Reference Guide

## Current State Summary

**Existing Tests**: 3 files, 170+ test cases ✅
**Test Infrastructure**: Needs setup ❌
**pytest Installed**: No ❌

---

## Test Patterns at a Glance

### Pattern 1: Schema Testing (test_auth_password_reset.py)
```python
# Direct import & validation without DB
from app.schemas.user import PasswordResetRequest
request = PasswordResetRequest(email="test@example.com")
assert request.email == "test@example.com"
```
**Use for**: Pydantic schema validation, business logic without persistence

---

### Pattern 2: Integration Testing (test_gmail_integration.py)
```python
@pytest.fixture
def provider(self):
    from app.services.oauth.gmail import GmailOAuthProvider
    return GmailOAuthProvider(
        client_id="test-client-id",
        client_secret="test-client-secret",
        redirect_uri="http://localhost:8000/oauth/gmail/callback"
    )

def test_authorization_url_generation(self, provider):
    url = provider.get_authorization_url("state-123")
    assert "accounts.google.com" in url
```
**Use for**: Service initialization, OAuth flow, dataclass creation

---

### Pattern 3: Async Testing (test_query_pipeline.py)
```python
@pytest.mark.asyncio
@patch('app.services.query_service.generate_embedding')
async def test_query_pipeline(mock_embed):
    mock_embed.return_value = [0.1] * 1536
    result = await service.process_query(...)
    assert "answer" in result
```
**Use for**: Async service testing, RAG pipeline, patching external calls

---

## Priority Modules for Test Coverage

### 🔴 Tier 1: Critical (Missing)
1. **Auth Endpoints** - `/auth/login`, `/auth/register`, password reset flows
2. **Database Models** - User, Document, OAuthConnection, Decision
3. **Document Upload** - `/documents/upload` endpoint
4. **OAuth Callback** - `/oauth/callback/{provider}` endpoint

### 🟠 Tier 2: Important (Missing)
5. **Query Endpoints** - `/query/search`, query execution
6. **Integration Management** - `/integrations/sync`, provider sync
7. **Vector Service** - Embedding & vector operations
8. **Graph Service** - Neo4j graph operations

### 🟡 Tier 3: Enhancement (Missing)
9. **Admin Routes** - User management, organization management
10. **Decision Routes** - Decision tracking & history
11. **Analytics** - Metrics & analytics collection
12. **Monitoring** - Health checks & system metrics

---

## Directory Structure (Recommended)

```
tests/
├── conftest.py                    # 🔴 CRITICAL: Setup database, auth, fixtures
├── test_auth_password_reset.py    # ✅ Existing
├── test_gmail_integration.py      # ✅ Existing
├── test_query_pipeline.py         # ✅ Existing
│
├── unit/
│   ├── conftest.py
│   ├── test_auth_service.py
│   ├── test_encryption.py
│   └── test_cache_service.py
│
├── api/
│   ├── conftest.py
│   ├── test_auth_endpoints.py     # 🔴 CRITICAL: /auth/* routes
│   ├── test_documents_endpoints.py
│   ├── test_query_endpoints.py
│   └── test_oauth_endpoints.py
│
├── integration/
│   ├── conftest.py
│   ├── test_document_ingestion_flow.py
│   └── test_query_end_to_end.py
│
├── models/
│   ├── test_user_model.py         # 🔴 CRITICAL
│   ├── test_document_model.py      # 🔴 CRITICAL
│   └── test_oauth_connection_model.py
│
└── fixtures/
    ├── users.py
    ├── documents.py
    └── oauth_tokens.py
```

---

## conftest.py Setup Checklist

### Root Level (`tests/conftest.py`)

```python
# 1. Event Loop for Async Tests
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# 2. In-Memory Test Database
@pytest.fixture(scope="session")
async def test_db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

# 3. Test Database Session
@pytest.fixture
async def test_db_session(test_db_engine):
    async with AsyncSession(test_db_engine) as session:
        yield session
        await session.rollback()

# 4. FastAPI Test Client
@pytest.fixture
def test_client(test_app):
    return TestClient(test_app)

# 5. Test User & Auth
@pytest.fixture
async def test_user(test_db_session, test_user_data):
    user = User(...hash_password...)
    test_db_session.add(user)
    await test_db_session.commit()
    return user

# 6. JWT Token & Auth Headers
@pytest.fixture
def auth_headers(test_jwt_token):
    return {"Authorization": f"Bearer {test_jwt_token}"}

# 7. Mock Services
@pytest.fixture
def mock_anthropic_client():
    mock = AsyncMock()
    mock.messages.create = AsyncMock(return_value=...)
    return mock
```

---

## Dependencies to Add to requirements.txt

```bash
# Testing Framework
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0
pytest-mock>=3.12.0

# Testing Utilities
httpx>=0.25.0           # Async HTTP client
pytest-timeout>=2.2.0
faker>=20.0.0           # Generate test data
factory-boy>=3.3.0      # Test factories

# Optional but Recommended
pytest-xdist>=3.5.0     # Parallel execution
pytest-dotenv>=0.5.0    # Load .env
```

---

## First Test to Write

**Start with**: `test_auth_endpoints.py`

Why?
- Foundation for all other endpoint tests
- Auth patterns used across all routes
- Clear success/failure criteria
- Helps establish testing patterns

```python
# tests/api/test_auth_endpoints.py

@pytest.mark.asyncio
async def test_register_endpoint(async_test_client, test_user_data):
    """Test user registration endpoint"""
    response = await async_test_client.post(
        "/auth/register",
        json=test_user_data
    )
    assert response.status_code == 201
    assert response.json()["email"] == test_user_data["email"]

@pytest.mark.asyncio
async def test_login_endpoint(async_test_client, test_user, test_user_data):
    """Test user login endpoint"""
    response = await async_test_client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": test_user_data["password"]
        }
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

@pytest.mark.asyncio
async def test_login_invalid_password(async_test_client, test_user):
    """Test login with wrong password"""
    response = await async_test_client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "wrong_password"
        }
    )
    assert response.status_code == 401
```

---

## Run Tests Command Reference

```bash
# Install dependencies (after adding to requirements.txt)
pip install pytest pytest-asyncio httpx

# Run all tests
pytest tests/

# Run with coverage
pytest --cov=app --cov-report=html tests/

# Run specific file
pytest tests/api/test_auth_endpoints.py -v

# Run specific test
pytest tests/api/test_auth_endpoints.py::test_login_endpoint -v

# Run by marker
pytest -m asyncio tests/

# Run in parallel
pytest -n auto tests/

# Run with verbose output
pytest -vv tests/

# Show print statements
pytest -s tests/
```

---

## Common Testing Patterns

### Async Test
```python
@pytest.mark.asyncio
async def test_async_operation(mock_cache_service):
    result = await service.async_method()
    assert result is not None
```

### Mocking External Service
```python
@patch('app.services.query_service.AsyncAnthropic')
async def test_with_mock(mock_anthropic):
    mock_anthropic.return_value.messages.create = AsyncMock(
        return_value=Mock(content=[Mock(text="response")])
    )
    result = await service.process_query(...)
```

### Database Test
```python
async def test_user_creation(test_db_session, test_user_data):
    user = User(**test_user_data)
    test_db_session.add(user)
    await test_db_session.commit()
    assert user.id is not None
```

### API Endpoint Test
```python
@pytest.mark.asyncio
async def test_endpoint(async_test_client, auth_headers):
    response = await async_test_client.get(
        "/api/documents",
        headers=auth_headers
    )
    assert response.status_code == 200
```

---

## Troubleshooting

### ❌ "No module named pytest"
```bash
pip install pytest pytest-asyncio
```

### ❌ "asyncio-related error"
Ensure conftest.py has:
```python
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
```

### ❌ "Database locked" during tests
Use in-memory SQLite in conftest:
```python
engine = create_async_engine("sqlite+aiosqlite:///:memory:")
```

### ❌ "ImportError" on app modules
Ensure tests can find app:
```bash
# Run from project root
cd /Users/michaelkraft/innosynth-ai/backend
pytest tests/
```

---

## Success Criteria

✅ **Phase 1 Complete When:**
- conftest.py setup with 7+ fixtures
- pytest installed & working
- test_auth_endpoints.py created with 5+ tests passing
- Coverage reports generated

---

## Resources

- pytest docs: https://docs.pytest.org
- pytest-asyncio: https://pytest-asyncio.readthedocs.io
- FastAPI testing: https://fastapi.tiangolo.com/advanced/testing
- SQLAlchemy async: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio

---

*Last Updated: December 9, 2024*
