-- Migration: Create oauth_connections table
-- Version: 001
-- Description: Adds OAuth connection storage with encrypted tokens

CREATE TABLE IF NOT EXISTS oauth_connections (
    connection_id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,

    -- Provider information
    provider VARCHAR(50) NOT NULL,

    -- Encrypted tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT,

    -- Token metadata
    expires_at TIMESTAMP,
    scopes TEXT NOT NULL,

    -- User information from provider
    connected_user_email VARCHAR(255),
    connected_user_name VARCHAR(255),
    provider_user_id VARCHAR(255),

    -- Additional provider-specific data
    provider_metadata TEXT,

    -- Connection status
    status VARCHAR(50) NOT NULL DEFAULT 'active',

    -- Sync status
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50),
    documents_synced INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_oauth_connections_org ON oauth_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_user ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider ON oauth_connections(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_status ON oauth_connections(status);

-- Create composite index for org + provider lookups
CREATE INDEX IF NOT EXISTS idx_oauth_connections_org_provider ON oauth_connections(organization_id, provider);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_oauth_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_connections_updated_at
    BEFORE UPDATE ON oauth_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_connections_updated_at();

-- Add comments for documentation
COMMENT ON TABLE oauth_connections IS 'Stores OAuth connection information with encrypted tokens for external integrations';
COMMENT ON COLUMN oauth_connections.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN oauth_connections.refresh_token IS 'Encrypted OAuth refresh token (optional)';
COMMENT ON COLUMN oauth_connections.provider_metadata IS 'JSON string containing provider-specific metadata';
