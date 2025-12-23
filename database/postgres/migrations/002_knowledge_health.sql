-- Knowledge health alerts table
CREATE TABLE knowledge_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(organization_id),
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    document_ids UUID[],
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(user_id),
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('conflict', 'outdated', 'gap')),
    CONSTRAINT valid_severity CHECK (severity IN ('high', 'medium', 'low')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'resolved', 'dismissed'))
);

CREATE INDEX idx_alerts_org ON knowledge_alerts(organization_id);
CREATE INDEX idx_alerts_status ON knowledge_alerts(status);
CREATE INDEX idx_alerts_type ON knowledge_alerts(alert_type);
