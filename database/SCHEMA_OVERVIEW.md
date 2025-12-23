# InnoSynth.ai Database Schema Overview

## Polyglot Persistence Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    InnoSynth.ai Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Neo4j     │  │   Pinecone   │      │
│  │              │  │              │  │              │      │
│  │  Relational  │  │   Knowledge  │  │   Vector     │      │
│  │     Data     │  │    Graph     │  │   Search     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│                    ┌──────────────┐                         │
│                    │    Redis     │                         │
│                    │   Caching    │                         │
│                    └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## PostgreSQL Schema

### Core Tables

**organizations**
- Primary key: `organization_id` (UUID)
- Fields: name, domain, subscription_tier, settings (JSONB)
- Purpose: Multi-tenant customer data

**users**
- Primary key: `user_id` (UUID)
- Foreign key: `organization_id`
- Fields: email, name, hashed_password, role, is_active
- Roles: admin, user, viewer
- Purpose: User authentication and authorization

**documents**
- Primary key: `document_id` (UUID)
- Foreign key: `organization_id`
- Fields: source_system, source_id, title, author, mime_type, file_size, url
- Status: embedding_status, chunk_count
- Sources: sharepoint, gdrive, slack
- Purpose: Document metadata (content in Pinecone)

**queries**
- Primary key: `query_id` (UUID)
- Foreign keys: `user_id`, `organization_id`
- Fields: query_text, response_text, response_time_ms, sources_cited, tokens_used
- Purpose: Analytics and ROI tracking

**oauth_tokens**
- Primary key: `token_id` (UUID)
- Foreign key: `organization_id`
- Fields: provider, access_token, refresh_token, expires_at, scopes
- Providers: google, microsoft, slack
- Purpose: OAuth integration credentials

**knowledge_alerts**
- Primary key: `alert_id` (UUID)
- Foreign key: `organization_id`
- Fields: alert_type, title, description, severity, document_ids, status
- Types: conflict, outdated, gap
- Severities: high, medium, low
- Purpose: Knowledge health monitoring

### Indexes
- User email, organization lookups
- Document organization and source system
- Query analytics by user and organization
- OAuth provider lookups
- Alert status and type filtering

## Neo4j Knowledge Graph

### Node Types

**Document**
- Properties: id, organization_id, source_system, title, created_at
- Purpose: Files and messages

**Person**
- Properties: id, name, email, organization_id
- Purpose: Authors and users

**Decision**
- Properties: id, name, description, organization_id, made_at
- Purpose: Key decision points

**Event**
- Properties: id, type, title, timestamp, organization_id
- Purpose: Timestamped occurrences

**Assumption**
- Properties: id, text, confidence, source_id
- Purpose: Stated beliefs and data points

**Organization**
- Properties: id, name, domain
- Purpose: Root node for each tenant

### Relationship Types

```
Person --[AUTHORED]--> Document
Document --[CITED]--> Document
Event --[INFLUENCED]--> Decision
Decision --[BASED_ON]--> Assumption
Document --[REFERENCED_IN]--> Decision
Document --[CONTRADICTS]--> Document
Person --[MADE]--> Decision
```

### Constraints & Indexes
- Unique constraints on all node IDs
- Indexes on organization_id, source_system, email
- Full-text search on document titles/content and decision names/descriptions

## Pinecone Vector Database

### Index Configuration
- **Name**: `innosynth-documents`
- **Dimensions**: 1536 (OpenAI text-embedding-3-small)
- **Metric**: Cosine similarity
- **Cloud**: AWS us-east-1 (serverless)

### Vector Metadata Schema
```python
{
    "document_id": str,        # UUID from PostgreSQL
    "organization_id": str,    # Organization UUID
    "source_system": str,      # 'sharepoint', 'gdrive', 'slack'
    "title": str,              # Document title
    "author": str,             # Author name/email
    "created_at": str,         # ISO timestamp
    "url": str,                # Link to source
    "chunk_index": int,        # Position in document
    "chunk_total": int         # Total chunks in document
}
```

### Indexed Metadata Fields
- organization_id
- source_system
- author
- created_at

### Search Configuration
- Top K: 20 results
- Include metadata: Yes
- Include values: No (vectors not returned)

## Redis Cache

### Use Cases
- **Session Caching**: User authentication sessions
- **Query Results**: 5-minute TTL on query responses
- **Rate Limiting**: API call throttling
- **Sync Status**: Real-time document indexing status

### Key Patterns
```
session:{user_id}           -> Session data
query:{hash}                -> Cached query result
ratelimit:{org_id}:{minute} -> Request count
sync:{organization_id}      -> Sync progress
```

## Data Flow

### Document Ingestion
```
1. OAuth → SharePoint/Google Drive/Slack
2. Download → Extract text/metadata
3. PostgreSQL → Store metadata (documents table)
4. Neo4j → Create Document node + relationships
5. Chunk → Split into semantic chunks
6. Embed → OpenAI text-embedding-3-small
7. Pinecone → Store vectors with metadata
```

### Query Processing
```
1. User query → Redis (check cache)
2. Embed query → OpenAI API
3. Vector search → Pinecone (top 20 results)
4. Context assembly → Retrieve from PostgreSQL
5. Graph enrichment → Neo4j relationships
6. LLM generation → Claude/GPT-4
7. Store analytics → PostgreSQL queries table
8. Cache result → Redis (5 min TTL)
```

### Knowledge Health Analysis
```
1. Scheduled job → Nightly analysis
2. Vector similarity → Find conflicting documents
3. Timestamp analysis → Identify outdated content
4. Graph analysis → Detect knowledge gaps
5. Create alerts → PostgreSQL knowledge_alerts table
6. Notify users → Email/dashboard
```

## Maintenance

### PostgreSQL Backups
```bash
pg_dump -U postgres innosynth > backup_$(date +%Y%m%d).sql
```

### Neo4j Backups
```bash
neo4j-admin backup --to=/backups/neo4j-$(date +%Y%m%d)
```

### Pinecone Index Management
```python
# Check index stats
index.describe_index_stats()

# Delete old vectors (if needed)
index.delete(filter={"organization_id": "org-to-remove"})
```

### Redis Monitoring
```bash
redis-cli INFO memory
redis-cli KEYS "query:*" | wc -l  # Count cached queries
```

## Scaling Considerations

### PostgreSQL
- Connection pooling (pgBouncer)
- Read replicas for analytics queries
- Partition queries table by created_at

### Neo4j
- Enterprise clustering for HA
- Separate read replicas for graph queries
- Index optimization for common patterns

### Pinecone
- Serverless auto-scales
- Monitor vector count and query latency
- Consider namespace partitioning per organization

### Redis
- Redis Cluster for horizontal scaling
- Separate cache instances per use case
- Monitor eviction rate and memory usage
