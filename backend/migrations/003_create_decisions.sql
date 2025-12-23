-- Migration: Create decisions, decision_factors, and decision_outcomes tables
-- Created: 2025-12-03
-- Description: Database schema for InnoSynth.ai decision tracking system

-- Create decisions table
CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    context JSONB,
    graph_node_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decision_date TIMESTAMP,

    -- Indexes for performance
    CONSTRAINT decisions_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_decisions_user_id ON decisions(user_id);
CREATE INDEX idx_decisions_created_at ON decisions(created_at DESC);
CREATE INDEX idx_decisions_category ON decisions(category);
CREATE INDEX idx_decisions_status ON decisions(status);
CREATE INDEX idx_decisions_title ON decisions USING gin(to_tsvector('english', title));
CREATE INDEX idx_decisions_description ON decisions USING gin(to_tsvector('english', description));


-- Create decision_factors table
CREATE TABLE IF NOT EXISTS decision_factors (
    id VARCHAR(36) PRIMARY KEY,
    decision_id VARCHAR(36) NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    impact_score INTEGER NOT NULL CHECK (impact_score >= 1 AND impact_score <= 10),
    explanation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT decision_factors_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_decision_factors_decision_id ON decision_factors(decision_id);
CREATE INDEX idx_decision_factors_category ON decision_factors(category);
CREATE INDEX idx_decision_factors_impact_score ON decision_factors(impact_score DESC);


-- Create decision_outcomes table
CREATE TABLE IF NOT EXISTS decision_outcomes (
    id VARCHAR(36) PRIMARY KEY,
    decision_id VARCHAR(36) NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    outcome_type VARCHAR(50) NOT NULL,
    likelihood INTEGER CHECK (likelihood >= 0 AND likelihood <= 100),
    impact VARCHAR(20),
    timeframe VARCHAR(50),
    status VARCHAR(50) DEFAULT 'predicted',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT decision_outcomes_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_decision_outcomes_decision_id ON decision_outcomes(decision_id);
CREATE INDEX idx_decision_outcomes_type ON decision_outcomes(outcome_type);
CREATE INDEX idx_decision_outcomes_status ON decision_outcomes(status);


-- Add trigger to update updated_at timestamp for decisions
CREATE OR REPLACE FUNCTION update_decisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_decisions_updated_at
    BEFORE UPDATE ON decisions
    FOR EACH ROW
    EXECUTE FUNCTION update_decisions_updated_at();


-- Add trigger to update updated_at timestamp for decision_outcomes
CREATE OR REPLACE FUNCTION update_decision_outcomes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_decision_outcomes_updated_at
    BEFORE UPDATE ON decision_outcomes
    FOR EACH ROW
    EXECUTE FUNCTION update_decision_outcomes_updated_at();


-- Insert sample data for testing (optional - can be removed in production)
-- Uncomment these lines if you want sample data

/*
-- Sample decision
INSERT INTO decisions (id, user_id, title, description, category, status, decision_date)
VALUES (
    'dec-sample-001',
    'user-admin-001',
    'Migrate to microservices architecture',
    'Decision to migrate our monolithic application to a microservices architecture to improve scalability and deployment flexibility. This decision was made after careful consideration of team size, technical debt, and future growth plans.',
    'technical',
    'active',
    '2024-06-15 10:00:00'
);

-- Sample factors
INSERT INTO decision_factors (id, decision_id, name, category, impact_score, explanation)
VALUES
    ('fac-001', 'dec-sample-001', 'Scalability Requirements', 'technical', 9, 'Current monolith cannot handle projected user growth'),
    ('fac-002', 'dec-sample-001', 'Team Size', 'organizational', 7, 'Growing team needs better separation of concerns'),
    ('fac-003', 'dec-sample-001', 'Technical Debt', 'technical', 6, 'Monolith has accumulated significant technical debt'),
    ('fac-004', 'dec-sample-001', 'Budget Constraints', 'financial', 5, 'Migration will require significant investment');

-- Sample outcomes
INSERT INTO decision_outcomes (id, decision_id, description, outcome_type, likelihood, impact, timeframe, status)
VALUES
    ('out-001', 'dec-sample-001', 'Improved system scalability by 300%', 'predicted', 85, 'high', 'medium-term', 'predicted'),
    ('out-002', 'dec-sample-001', 'Increased operational complexity', 'risk', 70, 'medium', 'short-term', 'predicted'),
    ('out-003', 'dec-sample-001', 'Better team autonomy and productivity', 'opportunity', 75, 'high', 'medium-term', 'predicted');
*/


-- Add comments for documentation
COMMENT ON TABLE decisions IS 'Stores business decisions made by users';
COMMENT ON TABLE decision_factors IS 'Factors that influenced each decision';
COMMENT ON TABLE decision_outcomes IS 'Predicted and actual outcomes of decisions';

COMMENT ON COLUMN decisions.graph_node_id IS 'Reference to the corresponding node in Neo4j knowledge graph';
COMMENT ON COLUMN decisions.context IS 'Additional structured metadata stored as JSON';
COMMENT ON COLUMN decision_factors.impact_score IS 'Impact score from 1-10 indicating how much this factor influenced the decision';
COMMENT ON COLUMN decision_outcomes.likelihood IS 'Likelihood percentage (0-100) for predicted outcomes';
