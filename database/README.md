# InnoSynth.ai Database Schemas

## Overview

InnoSynth.ai uses a polyglot persistence architecture:

- **PostgreSQL**: Relational data (users, organizations, documents metadata, queries)
- **Neo4j**: Temporal knowledge graph (decisions, events, relationships)
- **Pinecone**: Vector database (document embeddings for semantic search)
- **Redis**: Caching layer (session data, query results)

## PostgreSQL

### Migrations
Run migrations in order:
```bash
psql -U postgres -d innosynth -f postgres/migrations/001_initial_schema.sql
psql -U postgres -d innosynth -f postgres/migrations/002_knowledge_health.sql
```

### Key Tables
- `organizations` - Customer organizations
- `users` - User accounts with roles
- `documents` - Document metadata (content stored in Pinecone)
- `queries` - Query analytics for ROI tracking
- `oauth_tokens` - OAuth tokens for integrations

## Neo4j

### Initialize Schema
```bash
cypher-shell -f neo4j/schema.cypher
```

### Node Types
- `Document` - Files and messages
- `Person` - Users and authors
- `Decision` - Key decision points
- `Event` - Timestamped occurrences
- `Assumption` - Stated beliefs/data points

### Relationship Types
- `AUTHORED` - Person created document
- `CITED` - Document references another
- `INFLUENCED` - Event influenced decision
- `BASED_ON` - Decision based on assumption
- `CONTRADICTS` - Conflicting documents

## Pinecone

### Configuration
- Index: `innosynth-documents`
- Dimensions: 1536 (OpenAI text-embedding-3-small)
- Metric: Cosine similarity

### Initialize Index
```bash
cd pinecone
python init_index.py
```

## Redis

Used for:
- Session caching
- Query result caching (5 minute TTL)
- Rate limiting
- Real-time sync status
