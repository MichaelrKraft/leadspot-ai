# Query Pipeline Implementation

Complete RAG (Retrieval-Augmented Generation) pipeline for InnoSynth.ai knowledge synthesis.

## Overview

The query pipeline implements a sophisticated RAG system that:
1. **Embeds** user queries into vector space
2. **Searches** for relevant documents in Pinecone
3. **Builds context** from retrieved chunks with token management
4. **Synthesizes** answers using Claude 3.5 Sonnet
5. **Extracts citations** and matches them to source documents

## Architecture

```
┌─────────────┐
│   Query     │
└──────┬──────┘
       │
       ├──► Cache Check (Redis)
       │         │
       │    ┌────▼────┐
       │    │  Cache  │──► Return Cached Result
       │    │   Hit   │
       │    └─────────┘
       │
       ├──► Generate Embedding (OpenAI)
       │         │
       │    ┌────▼────────┐
       │    │   Pinecone  │──► Similar Documents
       │    │   Search    │
       │    └─────────────┘
       │
       ├──► Build Context (Token Management)
       │         │
       │    ┌────▼────────┐
       │    │   Claude    │──► Synthesized Answer
       │    │  Synthesis  │
       │    └─────────────┘
       │
       └──► Extract Citations
                 │
            ┌────▼─────┐
            │  Return  │
            │  Result  │
            └──────────┘
```

## Components

### 1. Query Service (`app/services/query_service.py`)

**Purpose**: Orchestrates the complete RAG pipeline

**Key Methods**:
- `process_query()`: Main pipeline execution
- `_get_or_generate_embedding()`: Embedding with cache
- `_synthesize_answer()`: Claude synthesis

**Pipeline Metrics**:
- Embed time (ms)
- Search time (ms)
- Context building time (ms)
- Synthesis time (ms)
- Citation extraction time (ms)
- Total time (ms)
- Tokens used
- Cache hit status

### 2. Context Builder (`app/services/context_builder.py`)

**Purpose**: Build optimized context for Claude within token limits

**Features**:
- Token counting with `tiktoken`
- 100k token context window management
- Source prioritization by relevance
- Intelligent excerpt truncation
- Context metadata tracking

**Key Methods**:
- `build_context()`: Main context building
- `count_tokens()`: Accurate token counting
- `_format_source()`: Source formatting
- `_truncate_source()`: Smart truncation

**Token Limits**:
- Max context: 100,000 tokens (Claude 3.5 Sonnet)
- Reserved: 5,000 tokens (prompt + response)
- Available: 95,000 tokens

### 3. Citation Service (`app/services/citation_service.py`)

**Purpose**: Extract and match citations from synthesized answers

**Features**:
- Multiple citation pattern detection
- Fuzzy title matching
- Citation coverage metrics
- Uncited source detection

**Citation Patterns**:
- `[Document Title]`
- `according to Document Title`
- `as stated in Document Title`
- `per Document Title`
- `from Document Title`

**Key Methods**:
- `extract_citations()`: Find all citations
- `get_cited_sources()`: List cited sources
- `get_uncited_sources()`: Find unused sources
- `calculate_citation_coverage()`: Coverage metrics

### 4. Cache Service (`app/services/cache_service.py`)

**Purpose**: Redis-based caching for performance

**Cache Types**:
- Query results (5 min TTL)
- Embeddings (24 hour TTL)
- Query history (7 day TTL)

**Key Methods**:
- `get_query_result()`: Check cache
- `set_query_result()`: Cache result
- `get_embedding()`: Cached embeddings
- `invalidate_query_cache()`: Clear org cache

**Performance Impact**:
- ~2000ms → ~50ms for cache hits
- 95%+ reduction in API costs for repeated queries

### 5. Analytics Service (`app/services/analytics_service.py`)

**Purpose**: Track and analyze query usage

**Features**:
- Query logging to PostgreSQL
- Organization statistics
- User statistics
- Popular query patterns
- Performance trends

**Metrics Tracked**:
- Total queries
- Unique users
- Average response time
- Average sources cited
- Total tokens used
- Cache hit rate
- Queries per day

## API Endpoints

### POST `/api/query`

Process a knowledge synthesis query.

**Request**:
```json
{
  "query": "What are our strategic priorities for Q4?",
  "organization_id": "uuid",
  "max_sources": 10,
  "use_cache": true
}
```

**Response**:
```json
{
  "query_id": "uuid",
  "answer": "Based on the Strategic Planning Document...",
  "sources": [
    {
      "document_id": "uuid",
      "title": "Strategic Planning Document",
      "url": "https://...",
      "excerpt": "...",
      "relevance_score": 0.95
    }
  ],
  "citations": [
    {
      "citation_text": "Strategic Planning Document",
      "document_id": "uuid",
      "document_title": "Strategic Planning Document",
      "url": "https://...",
      "excerpt": "...",
      "context": "According to Strategic Planning Document...",
      "position_in_answer": 42
    }
  ],
  "citation_coverage": {
    "total_sources_available": 10,
    "sources_cited": 7,
    "total_citations": 12,
    "citation_coverage_percent": 70.0,
    "average_citations_per_source": 1.71,
    "uncited_source_count": 3
  },
  "metrics": {
    "embed_time_ms": 145,
    "search_time_ms": 89,
    "context_time_ms": 23,
    "synthesis_time_ms": 1847,
    "citation_time_ms": 45,
    "total_time_ms": 2149,
    "cache_hit": false,
    "tokens_used": 5432,
    "context_metadata": {
      "sources_included": 7,
      "total_sources_available": 10,
      "total_tokens": 12450,
      "utilization_percent": 13.1
    }
  },
  "total_sources_found": 10,
  "sources_used": 7
}
```

### GET `/api/query/history`

Get user's query history.

**Query Params**:
- `limit`: Max queries (1-100, default: 20)
- `offset`: Skip queries (default: 0)

### GET `/api/query/{query_id}`

Get details about a specific query.

### GET `/api/query/stats/organization`

Get organization-wide statistics.

**Query Params**:
- `days`: Analysis period (1-365, default: 30)

### GET `/api/query/stats/popular`

Get most popular queries.

**Query Params**:
- `limit`: Max queries (1-50, default: 10)
- `days`: Analysis period (1-365, default: 30)

### GET `/api/query/stats/trends`

Get daily performance trends.

**Query Params**:
- `days`: Analysis period (1-365, default: 30)

## Prompt Engineering

### Synthesis Prompt (`app/core/prompts.py`)

The synthesis prompt instructs Claude to:
- Analyze sources carefully
- Cite using `[Document Title]` notation
- Provide actionable insights
- Structure answers clearly
- Acknowledge limitations
- Flag contradictions

**Key Guidelines**:
- Executive-level clarity
- Frequent citation
- Specific data points
- Professional language
- Honest about gaps

## Database Schema

### queries Table

```sql
CREATE TABLE queries (
    query_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id),
    query_text TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    sources_cited INTEGER NOT NULL DEFAULT 0,
    total_sources_found INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queries_user_id ON queries(user_id);
CREATE INDEX idx_queries_organization_id ON queries(organization_id);
CREATE INDEX idx_queries_created_at ON queries(created_at);
```

## Configuration

### Environment Variables

```bash
# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Vector Database
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX=innosynth-embeddings

# Cache
REDIS_URL=redis://localhost:6379/0

# Models
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536
SYNTHESIS_MODEL=claude-3-5-sonnet-20241022
```

## Performance Optimization

### Token Management

- Claude 3.5 Sonnet: 200k context window
- Conservative limit: 100k tokens
- Reserved tokens: 5k (prompt + response)
- Available for context: 95k tokens

### Caching Strategy

**Query Results** (5 min):
- Identical queries return cached results
- Invalidate when documents change

**Embeddings** (24 hours):
- Cache query embeddings
- Reuse for similar queries

**Query History** (7 days):
- Fast access to recent queries
- Trimmed to 50 most recent

### Cost Optimization

**Per Query Costs** (approximate):
- Embedding: $0.00002 (cached after first)
- Pinecone: $0.00001
- Claude Synthesis: $0.015-0.045 (varies by length)
- **Cache Hit**: $0 (no API calls)

**Cache Impact**:
- 50% cache hit rate → 50% cost reduction
- 75% cache hit rate → 75% cost reduction

## Testing

Run integration tests:

```bash
cd backend
pytest tests/test_query_pipeline.py -v
```

**Test Coverage**:
- Context token management
- Citation extraction
- Citation coverage calculation
- End-to-end pipeline
- Empty sources handling
- Cache hit scenario
- Context truncation
- Token counting accuracy

## Deployment

### Database Migration

```bash
cd backend
psql $DATABASE_URL < migrations/002_add_query_analytics_fields.sql
```

### Dependencies

```bash
pip install -r requirements-query-pipeline.txt
```

### Redis Setup

```bash
# macOS
brew install redis
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

## Monitoring

### Key Metrics

- **Response Time**: Target < 3s
- **Cache Hit Rate**: Target > 50%
- **Citation Coverage**: Target > 60%
- **Token Utilization**: Target 10-30%

### Alerts

- Response time > 5s
- Cache hit rate < 30%
- Error rate > 5%
- Token usage spike

## Future Enhancements

1. **Multi-Query Synthesis**: Combine multiple related queries
2. **Follow-Up Generation**: AI-powered follow-up questions
3. **Decision Detection**: Identify decision-support queries
4. **Entity Extraction**: Enhanced search with entities
5. **Context Relevance Scoring**: AI re-ranking of sources
6. **Streaming Responses**: Real-time answer streaming
7. **Query Expansion**: Automatic query reformulation
8. **Source Diversity**: Ensure diverse source selection

## Troubleshooting

### High Response Times

1. Check Redis connectivity
2. Review token utilization (may be too high)
3. Check Claude API latency
4. Verify Pinecone performance

### Low Citation Coverage

1. Review prompt engineering
2. Check source quality
3. Verify citation patterns
4. Test with different queries

### Cache Not Working

1. Verify Redis connection
2. Check TTL settings
3. Review cache key generation
4. Monitor Redis memory

## Support

For issues or questions:
- Check logs: `backend/logs/query_pipeline.log`
- Review metrics: `/api/query/stats/organization`
- Test endpoint: `/api/health`
