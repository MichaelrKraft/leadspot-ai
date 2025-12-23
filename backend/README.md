# InnoSynth.ai Backend

FastAPI backend for the InnoSynth.ai enterprise knowledge synthesis platform.

## Features

- **FastAPI** - Modern async web framework
- **PostgreSQL** - Relational database for structured data
- **Neo4j** - Graph database for relationships
- **Pinecone** - Vector database for semantic search
- **Redis** - Caching and session management
- **Claude AI** - Answer synthesis
- **OpenAI** - Embeddings generation
- **JWT Authentication** - Secure user authentication

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings and configuration
│   ├── database.py          # Database connection
│   ├── models/              # SQLAlchemy models
│   │   ├── user.py
│   │   ├── organization.py
│   │   ├── document.py
│   │   └── query.py
│   ├── schemas/             # Pydantic schemas
│   │   ├── user.py
│   │   └── query.py
│   ├── routers/             # API routes
│   │   ├── auth.py
│   │   ├── query.py
│   │   └── health.py
│   └── services/            # Business logic
│       ├── auth_service.py
│       ├── embedding_service.py
│       ├── synthesis_service.py
│       └── vector_service.py
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Set Up Databases

**PostgreSQL:**
```bash
# Create database
createdb innosynth

# Run migrations (after setting up Alembic)
alembic upgrade head
```

**Neo4j:**
```bash
# Install and start Neo4j
# Update .env with connection details
```

**Pinecone:**
```bash
# Get API key from pinecone.io
# Update .env with API key
# Index will be created automatically on first run
```

**Redis:**
```bash
# Install and start Redis
redis-server
```

### 4. Run Development Server

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Query
- `POST /api/query` - Process knowledge synthesis query

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

### Running Tests
```bash
pytest
```

### Database Migrations
```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Code Formatting
```bash
# Format code
black app/

# Lint code
flake8 app/
```

## Production Deployment

### Environment Variables
Ensure all production environment variables are set:
- Strong JWT_SECRET
- Production database URLs
- API keys for external services

### Run with Gunicorn
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Docker Deployment
```bash
# Build image
docker build -t innosynth-backend .

# Run container
docker run -p 8000:8000 --env-file .env innosynth-backend
```

## Architecture

### Authentication Flow
1. User registers/logs in
2. Server generates JWT token
3. Client includes token in Authorization header
4. Server validates token on protected routes

### Query Processing Flow
1. Receive user query
2. Generate embedding using OpenAI
3. Search Pinecone for similar documents
4. Synthesize answer using Claude
5. Track analytics in PostgreSQL
6. Return response with sources

### Multi-tenancy
- Organizations are isolated by `organization_id`
- All queries filtered by organization
- Vector database uses metadata filtering

## License

Proprietary - All Rights Reserved
