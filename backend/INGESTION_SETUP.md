# Document Ingestion Pipeline - Setup Guide

## Overview

This guide helps you integrate the document ingestion pipeline into your InnoSynth.ai backend.

## Installation

### 1. Install Dependencies

Add to `requirements.txt`:

```txt
# Document Processing
PyMuPDF>=1.23.0         # PDF extraction
python-docx>=1.1.0      # Word documents
openpyxl>=3.1.0         # Excel files
beautifulsoup4>=4.12.0  # HTML parsing
markdown>=3.5.0         # Markdown parsing
aiofiles>=23.2.0        # Async file I/O

# Text Processing
tiktoken>=0.5.0         # Token counting
langdetect>=1.0.9       # Language detection

# AI & Embeddings
openai>=1.10.0          # OpenAI API
pinecone-client>=3.0.0  # Pinecone vector DB
neo4j>=5.15.0           # Neo4j graph DB

# Utilities
tenacity>=8.2.0         # Retry logic
python-multipart>=0.0.6 # File uploads
PyJWT>=2.8.0            # JWT auth
```

Install:
```bash
pip install -r requirements.txt
```

### 2. Environment Variables

Add to `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws  # or your region
PINECONE_INDEX_NAME=innosynth-documents

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# JWT (if not already configured)
JWT_SECRET=your-secret-key-change-in-production
```

## Integration with FastAPI

### 1. Update Main App (`app/main.py`)

```python
from fastapi import FastAPI
from app.routers import documents
from app.dependencies import init_pipeline
from app.workers.sync_worker import init_sync_worker
import os

app = FastAPI(title="InnoSynth.ai API")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""

    # Initialize ingestion pipeline
    pipeline = init_pipeline(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        pinecone_api_key=os.getenv("PINECONE_API_KEY"),
        pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
        pinecone_index_name=os.getenv("PINECONE_INDEX_NAME"),
        neo4j_uri=os.getenv("NEO4J_URI"),
        neo4j_username=os.getenv("NEO4J_USERNAME"),
        neo4j_password=os.getenv("NEO4J_PASSWORD")
    )

    # Initialize sync worker
    sync_worker = init_sync_worker(pipeline)
    await sync_worker.start()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    from app.dependencies import get_ingestion_pipeline
    from app.workers.sync_worker import get_sync_worker

    pipeline = get_ingestion_pipeline()
    await pipeline.close()

    worker = get_sync_worker()
    await worker.stop()

# Include document router
app.include_router(documents.router)
```

### 2. Test the API

Start the server:
```bash
uvicorn app.main:app --reload --port 8000
```

Visit: `http://localhost:8000/docs` for interactive API documentation.

## Usage Examples

### Upload a Document

```bash
curl -X POST "http://localhost:8000/api/documents/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

### Query Documents

```bash
curl -X POST "http://localhost:8000/api/documents/query" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key findings?",
    "top_k": 5
  }'
```

### Get Document Status

```bash
curl -X GET "http://localhost:8000/api/documents/{document_id}/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Delete Document

```bash
curl -X DELETE "http://localhost:8000/api/documents/{document_id}" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Setup

### Pinecone

1. Create account at https://www.pinecone.io/
2. Create a new index:
   - Name: `innosynth-documents`
   - Dimension: `1536` (for text-embedding-3-small)
   - Metric: `cosine`
   - Cloud: `AWS`
   - Region: `us-east-1` (or your preferred region)
3. Copy API key to `.env`

### Neo4j

Option 1: Local Installation
```bash
# Using Docker
docker run \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  neo4j:latest
```

Option 2: Neo4j AuraDB (Cloud)
1. Create account at https://neo4j.com/cloud/aura/
2. Create a free instance
3. Copy connection URI and credentials to `.env`

## Testing

### Quick Test Script

Create `test_ingestion.py`:

```python
import asyncio
from app.dependencies import init_pipeline
import os
from dotenv import load_dotenv

load_dotenv()

async def test_ingestion():
    pipeline = init_pipeline(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        pinecone_api_key=os.getenv("PINECONE_API_KEY"),
        pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
        pinecone_index_name=os.getenv("PINECONE_INDEX_NAME"),
        neo4j_uri=os.getenv("NEO4J_URI"),
        neo4j_username=os.getenv("NEO4J_USERNAME"),
        neo4j_password=os.getenv("NEO4J_PASSWORD")
    )

    # Test with a simple text file
    test_content = b"""
    InnoSynth.ai Product Requirements Document

    Overview: InnoSynth.ai is an enterprise knowledge synthesis platform.

    Key Features:
    1. Document ingestion from multiple sources
    2. AI-powered knowledge extraction
    3. Graph-based relationship mapping
    """

    result = await pipeline.ingest_document(
        file_content=test_content,
        mime_type="text/plain",
        organization_id="test-org",
        metadata_override={"title": "Test Document"}
    )

    print("Ingestion Result:", result)

    await pipeline.close()

if __name__ == "__main__":
    asyncio.run(test_ingestion())
```

Run:
```bash
python test_ingestion.py
```

## Monitoring

### Check Pipeline Status

```python
from app.dependencies import get_ingestion_pipeline

pipeline = get_ingestion_pipeline()

# Get cache stats
cache_stats = pipeline.embedder.get_cache_stats()
print(f"Embedding cache: {cache_stats}")

# Get active ingestions
for doc_id, progress in pipeline.active_ingestions.items():
    print(f"{doc_id}: {progress.stage} - {progress.progress:.1%}")
```

### Check Worker Status

```python
from app.workers.sync_worker import get_sync_worker

worker = get_sync_worker()
stats = worker.get_stats()
print(f"Worker stats: {stats}")
```

## Troubleshooting

### Common Issues

**1. "Ingestion pipeline not initialized"**
- Ensure `init_pipeline()` is called in startup event
- Check environment variables are set

**2. "Invalid API key" errors**
- Verify API keys in `.env`
- Check API key permissions (OpenAI, Pinecone)

**3. Neo4j connection errors**
- Ensure Neo4j is running
- Check URI format: `bolt://localhost:7687`
- Verify credentials

**4. Pinecone index not found**
- Create index with correct name
- Verify index dimension matches embedding model (1536)

### Enable Debug Logging

Add to `app/main.py`:

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## Next Steps

1. ✅ Complete basic setup
2. 🔄 Test with sample documents
3. 🔄 Implement organization models
4. 🔄 Add document metadata database table
5. 🔄 Implement Google Drive sync
6. 🔄 Add monitoring dashboards
7. 🔄 Set up production deployment

## Support

For issues or questions:
- Check logs in `app/logs/`
- Review API docs at `/docs`
- Consult architecture in `tasks/todo.md`
