-- Migration: Add analytics fields to queries table
-- Date: 2024-12-02
-- Description: Adds organization_id, total_sources_found, tokens_used, and cache_hit to queries table

-- Add organization_id column
ALTER TABLE queries
ADD COLUMN organization_id UUID REFERENCES organizations(organization_id);

-- Add total_sources_found column
ALTER TABLE queries
ADD COLUMN total_sources_found INTEGER NOT NULL DEFAULT 0;

-- Add tokens_used column (nullable for optional tracking)
ALTER TABLE queries
ADD COLUMN tokens_used INTEGER;

-- Add cache_hit column
ALTER TABLE queries
ADD COLUMN cache_hit BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index on organization_id for performance
CREATE INDEX idx_queries_organization_id ON queries(organization_id);

-- Update existing rows to set organization_id from users table
UPDATE queries q
SET organization_id = u.organization_id
FROM users u
WHERE q.user_id = u.user_id;

-- Make organization_id NOT NULL after backfilling
ALTER TABLE queries
ALTER COLUMN organization_id SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN queries.organization_id IS 'Organization that owns this query for multi-tenant filtering';
COMMENT ON COLUMN queries.total_sources_found IS 'Total number of sources retrieved from vector search';
COMMENT ON COLUMN queries.tokens_used IS 'Total tokens used for embedding + synthesis (optional tracking)';
COMMENT ON COLUMN queries.cache_hit IS 'Whether this query result was served from cache';
