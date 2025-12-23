/**
 * Decision Type Definitions for InnoSynth.ai Decision Archaeology
 */

// Enums matching backend
export type DecisionCategory = 'strategic' | 'operational' | 'tactical' | 'financial' | 'technical';
export type DecisionStatus = 'active' | 'archived' | 'implemented' | 'abandoned';
export type FactorCategory = 'market' | 'financial' | 'technical' | 'organizational' | 'customer' | 'competitive' | 'regulatory' | 'strategic';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type Timeframe = 'short-term' | 'medium-term' | 'long-term';

// Factor Response
export interface Factor {
  id: string;
  decision_id: string;
  name: string;
  category: FactorCategory;
  impact_score: number;
  explanation?: string;
  created_at: string;
}

// Outcome Response
export interface Outcome {
  id: string;
  decision_id: string;
  description: string;
  outcome_type: string;
  likelihood?: number;
  impact?: ImpactLevel;
  timeframe?: Timeframe;
  status: string;
  created_at: string;
  updated_at: string;
}

// Decision Response
export interface Decision {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category?: DecisionCategory;
  status: DecisionStatus;
  context?: Record<string, unknown>;
  graph_node_id?: string;
  created_at: string;
  updated_at: string;
  decision_date?: string;
  factors: Factor[];
  outcomes: Outcome[];
}

// Create Decision Request
export interface DecisionCreate {
  title: string;
  description: string;
  category?: DecisionCategory;
  decision_date?: string;
  context?: Record<string, unknown>;
}

// Update Decision Request
export interface DecisionUpdate {
  title?: string;
  description?: string;
  category?: DecisionCategory;
  status?: DecisionStatus;
  decision_date?: string;
  context?: Record<string, unknown>;
}

// Query Request
export interface DecisionQuery {
  query: string;
  include_timeline?: boolean;
  include_factors?: boolean;
  max_results?: number;
}

// Timeline Event
export interface TimelineEventAPI {
  date: string;
  type: string;
  title: string;
  is_main: boolean;
  relationship?: string;
}

// Timeline Response
export interface TimelineResponse {
  decision_id: string;
  decision_title: string;
  events: TimelineEventAPI[];
}

// Related Decision
export interface RelatedDecision {
  id: string;
  title: string;
  date: string;
  relationships: string[];
  distance: number;
}

// Related Decisions Response
export interface RelatedDecisionsResponse {
  decision_id: string;
  related: RelatedDecision[];
}

// Factor Analysis
export interface FactorAnalysis {
  name: string;
  category: FactorCategory;
  impact_score: number;
  explanation: string;
}

// Factor Analysis Response
export interface FactorAnalysisResponse {
  decision_id: string;
  factors: FactorAnalysis[];
}

// Predicted Outcome
export interface PredictedOutcome {
  description: string;
  likelihood: number;
  impact: ImpactLevel;
  timeframe: Timeframe;
}

// Outcome Prediction Response
export interface OutcomePrediction {
  decision_id: string;
  outcomes: PredictedOutcome[];
  risks: string[];
  opportunities: string[];
}

// Graph Stats
export interface GraphStats {
  decisions: number;
  people: number;
  projects: number;
  factors: number;
  relationships: number;
}

// Decision List Response
export interface DecisionList {
  decisions: Decision[];
  total: number;
  page: number;
  page_size: number;
}

// Entity Extraction
export interface EntityExtraction {
  decisions: string[];
  people: string[];
  projects: string[];
  dates: string[];
  keywords: string[];
}

// Analysis Response
export interface AnalysisResponse {
  decision: Decision;
  timeline?: TimelineResponse;
  factors?: FactorAnalysis[];
  predictions?: OutcomePrediction;
  related_decisions?: RelatedDecision[];
}

// Pattern Analysis (for Phase 6)
export interface DecisionPattern {
  pattern_type: string;
  description: string;
  frequency: number;
  decisions: string[];
  timespan: {
    start: string;
    end: string;
  };
}

export interface PatternAnalysisResponse {
  patterns: DecisionPattern[];
  insights: string[];
  recommendations: string[];
}

// AI Insights (for Phase 6)
export interface AIInsight {
  type: 'observation' | 'recommendation' | 'risk' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  related_factors?: string[];
}

export interface AIInsightsResponse {
  decision_id: string;
  insights: AIInsight[];
  summary: string;
  generated_at: string;
}
