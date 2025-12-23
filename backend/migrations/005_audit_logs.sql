-- Migration: 005_audit_logs.sql
-- Create audit_logs table for tracking administrative actions and security events
-- Author: InnoSynth AI Team
-- Date: 2025-12-02

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,

    -- Action details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),

    -- Context
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Metadata
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- Comment on table
COMMENT ON TABLE audit_logs IS 'Audit trail for administrative actions, security events, and compliance tracking';

-- Comments on columns
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., user.create, org.update, user.delete)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (e.g., user, organization, document)';
COMMENT ON COLUMN audit_logs.resource_id IS 'Unique identifier of the affected resource';
COMMENT ON COLUMN audit_logs.details IS 'Additional context and metadata as JSON';
COMMENT ON COLUMN audit_logs.status IS 'Outcome of the action: success, failure, or error';
