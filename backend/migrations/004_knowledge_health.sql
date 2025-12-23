-- Migration: Knowledge Health System
-- Description: Database schema for health alerts, health scores, and health scan history
-- Version: 004
-- Created: 2025-01-03

-- ============================================================================
-- Health Alerts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Alert classification
    type VARCHAR(50) NOT NULL CHECK (type IN ('conflict', 'outdated', 'knowledge_gap')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),

    -- Alert content
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Conflict-specific fields
    doc1_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    doc2_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    similarity_score FLOAT,

    -- Outdated-specific fields
    doc_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    staleness_signals JSONB,

    -- Knowledge gap-specific fields
    query_pattern TEXT,
    occurrence_count INTEGER DEFAULT 0,
    suggested_topics TEXT[],
    gap_source VARCHAR(50),

    -- Resolution tracking
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    CONSTRAINT valid_alert_data CHECK (
        (type = 'conflict' AND doc1_id IS NOT NULL AND doc2_id IS NOT NULL) OR
        (type = 'outdated' AND doc_id IS NOT NULL) OR
        (type = 'knowledge_gap' AND query_pattern IS NOT NULL)
    )
);

-- Indexes for health_alerts
CREATE INDEX idx_health_alerts_org_id ON health_alerts(org_id);
CREATE INDEX idx_health_alerts_status ON health_alerts(status);
CREATE INDEX idx_health_alerts_severity ON health_alerts(severity);
CREATE INDEX idx_health_alerts_type ON health_alerts(type);
CREATE INDEX idx_health_alerts_created_at ON health_alerts(created_at DESC);
CREATE INDEX idx_health_alerts_org_status_severity ON health_alerts(org_id, status, severity);

-- ============================================================================
-- Health Scores Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Overall score
    overall_score FLOAT NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    health_status VARCHAR(20) NOT NULL CHECK (health_status IN ('excellent', 'good', 'fair', 'poor', 'critical')),

    -- Component scores
    completeness_score FLOAT NOT NULL CHECK (completeness_score >= 0 AND completeness_score <= 100),
    freshness_score FLOAT NOT NULL CHECK (freshness_score >= 0 AND freshness_score <= 100),
    consistency_score FLOAT NOT NULL CHECK (consistency_score >= 0 AND consistency_score <= 100),
    usage_score FLOAT NOT NULL CHECK (usage_score >= 0 AND usage_score <= 100),
    coverage_score FLOAT NOT NULL CHECK (coverage_score >= 0 AND coverage_score <= 100),

    -- Metrics snapshot
    total_documents INTEGER NOT NULL DEFAULT 0,
    total_queries INTEGER NOT NULL DEFAULT 0,
    successful_queries INTEGER NOT NULL DEFAULT 0,
    active_conflicts INTEGER NOT NULL DEFAULT 0,
    outdated_documents INTEGER NOT NULL DEFAULT 0,
    knowledge_gaps INTEGER NOT NULL DEFAULT 0,
    avg_doc_age_days FLOAT NOT NULL DEFAULT 0,

    -- Recommendations
    recommendations TEXT[],

    -- Timestamps
    calculated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for health_scores
CREATE INDEX idx_health_scores_org_id ON health_scores(org_id);
CREATE INDEX idx_health_scores_calculated_at ON health_scores(calculated_at DESC);
CREATE INDEX idx_health_scores_org_latest ON health_scores(org_id, calculated_at DESC);

-- ============================================================================
-- Health Scans Table (Scan history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Scan configuration
    scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('full', 'conflicts_only', 'outdated_only', 'gaps_only')),
    triggered_by VARCHAR(50) NOT NULL CHECK (triggered_by IN ('scheduled', 'manual', 'api')),
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Scan status
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),

    -- Scan results
    alerts_created INTEGER DEFAULT 0,
    conflicts_found INTEGER DEFAULT 0,
    outdated_found INTEGER DEFAULT 0,
    gaps_found INTEGER DEFAULT 0,

    -- Health score after scan
    health_score_id UUID REFERENCES health_scores(id) ON DELETE SET NULL,

    -- Execution details
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds FLOAT,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for health_scans
CREATE INDEX idx_health_scans_org_id ON health_scans(org_id);
CREATE INDEX idx_health_scans_status ON health_scans(status);
CREATE INDEX idx_health_scans_started_at ON health_scans(started_at DESC);
CREATE INDEX idx_health_scans_org_latest ON health_scans(org_id, started_at DESC);

-- ============================================================================
-- Query Tracking Table (For gap detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS query_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Query details
    query TEXT NOT NULL,
    query_normalized TEXT NOT NULL,

    -- Query results
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    result_count INTEGER NOT NULL DEFAULT 0,
    top_result_id UUID REFERENCES documents(id) ON DELETE SET NULL,

    -- Performance
    response_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for query_tracking
CREATE INDEX idx_query_tracking_org_id ON query_tracking(org_id);
CREATE INDEX idx_query_tracking_created_at ON query_tracking(created_at DESC);
CREATE INDEX idx_query_tracking_query_normalized ON query_tracking(query_normalized);
CREATE INDEX idx_query_tracking_confidence ON query_tracking(confidence);
CREATE INDEX idx_query_tracking_result_count ON query_tracking(result_count);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update updated_at timestamp on health_alerts
CREATE OR REPLACE FUNCTION update_health_alert_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_health_alert_updated_at
    BEFORE UPDATE ON health_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_health_alert_updated_at();

-- ============================================================================
-- Views
-- ============================================================================

-- Active alerts summary by organization
CREATE OR REPLACE VIEW v_active_alerts_summary AS
SELECT
    org_id,
    COUNT(*) as total_active_alerts,
    COUNT(*) FILTER (WHERE severity = 'high') as high_severity_count,
    COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity_count,
    COUNT(*) FILTER (WHERE severity = 'low') as low_severity_count,
    COUNT(*) FILTER (WHERE type = 'conflict') as conflict_count,
    COUNT(*) FILTER (WHERE type = 'outdated') as outdated_count,
    COUNT(*) FILTER (WHERE type = 'knowledge_gap') as gap_count
FROM health_alerts
WHERE status = 'active'
GROUP BY org_id;

-- Latest health score per organization
CREATE OR REPLACE VIEW v_latest_health_scores AS
SELECT DISTINCT ON (org_id)
    id,
    org_id,
    overall_score,
    health_status,
    completeness_score,
    freshness_score,
    consistency_score,
    usage_score,
    coverage_score,
    total_documents,
    active_conflicts,
    outdated_documents,
    knowledge_gaps,
    recommendations,
    calculated_at
FROM health_scores
ORDER BY org_id, calculated_at DESC;

-- Recent scan history per organization
CREATE OR REPLACE VIEW v_recent_scans AS
SELECT
    org_id,
    scan_type,
    status,
    alerts_created,
    started_at,
    completed_at,
    duration_seconds,
    ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY started_at DESC) as scan_rank
FROM health_scans
WHERE status = 'completed';

-- ============================================================================
-- Sample Data (for development/testing)
-- ============================================================================

-- Insert sample health score
-- INSERT INTO health_scores (
--     org_id,
--     overall_score,
--     health_status,
--     completeness_score,
--     freshness_score,
--     consistency_score,
--     usage_score,
--     coverage_score,
--     total_documents,
--     successful_queries,
--     recommendations
-- ) VALUES (
--     (SELECT id FROM organizations LIMIT 1),
--     85.5,
--     'good',
--     90.0,
--     80.0,
--     85.0,
--     88.0,
--     82.0,
--     50,
--     85,
--     ARRAY['Review and update outdated documents', 'Address identified knowledge gaps']
-- );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE health_alerts IS 'Health alerts for knowledge base issues (conflicts, outdated docs, gaps)';
COMMENT ON TABLE health_scores IS 'Historical health scores for organizations';
COMMENT ON TABLE health_scans IS 'Health scan execution history';
COMMENT ON TABLE query_tracking IS 'Query tracking for gap detection and analytics';

COMMENT ON COLUMN health_alerts.type IS 'Alert type: conflict, outdated, knowledge_gap';
COMMENT ON COLUMN health_alerts.severity IS 'Alert severity: high, medium, low';
COMMENT ON COLUMN health_alerts.status IS 'Alert status: active, resolved, dismissed';
COMMENT ON COLUMN health_alerts.metadata IS 'Additional alert-specific metadata (JSON)';

COMMENT ON COLUMN health_scores.overall_score IS 'Overall health score (0-100)';
COMMENT ON COLUMN health_scores.health_status IS 'Health status: excellent, good, fair, poor, critical';

COMMENT ON COLUMN query_tracking.query_normalized IS 'Normalized query text for pattern matching';
COMMENT ON COLUMN query_tracking.confidence IS 'Query result confidence score (0-1)';
