-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'pilot',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES organizations(organization_id),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('admin', 'user', 'viewer'))
);

-- Documents table (metadata only)
CREATE TABLE documents (
    document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(organization_id) NOT NULL,
    source_system VARCHAR(50) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    title TEXT,
    author VARCHAR(255),
    mime_type VARCHAR(100),
    file_size BIGINT,
    created_at TIMESTAMP,
    last_modified TIMESTAMP,
    url TEXT,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding_status VARCHAR(50) DEFAULT 'pending',
    chunk_count INTEGER DEFAULT 0,
    CONSTRAINT valid_source CHECK (source_system IN ('sharepoint', 'gdrive', 'slack'))
);

-- Queries table (for analytics)
CREATE TABLE queries (
    query_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    organization_id UUID REFERENCES organizations(organization_id),
    query_text TEXT NOT NULL,
    response_text TEXT,
    response_time_ms INTEGER,
    sources_cited INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth tokens table
CREATE TABLE oauth_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(organization_id),
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    scopes TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_provider CHECK (provider IN ('google', 'microsoft', 'slack'))
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_source ON documents(source_system, source_id);
CREATE INDEX idx_queries_user ON queries(user_id);
CREATE INDEX idx_queries_org ON queries(organization_id);
CREATE INDEX idx_queries_created ON queries(created_at);
CREATE INDEX idx_oauth_org_provider ON oauth_tokens(organization_id, provider);
