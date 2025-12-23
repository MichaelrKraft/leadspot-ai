// Health Dashboard TypeScript Types

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 'conflict' | 'outdated' | 'gap' | 'quality';
export type AlertStatus = 'active' | 'resolved' | 'dismissed' | 'in_progress';

export interface HealthAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  affected_documents: string[];
  metadata?: {
    conflict_details?: ConflictDetail;
    gap_details?: GapDetail;
    quality_issues?: string[];
  };
}

export interface ConflictDetail {
  document_ids: string[];
  conflicting_sections: Array<{
    document_id: string;
    content: string;
    section: string;
  }>;
  suggested_resolution?: string;
}

export interface GapDetail {
  topic: string;
  related_queries: string[];
  coverage_score: number;
  suggested_sources?: string[];
}

export interface HealthStats {
  total_documents: number;
  active_alerts: number;
  knowledge_gaps: number;
  documents_at_risk: number;
  last_scan: string | null;
  scan_in_progress: boolean;
}

export interface HealthDashboard {
  health_score: number;
  score_trend: number; // Percentage change from previous scan
  stats: HealthStats;
  recent_alerts: HealthAlert[];
  gap_analysis?: GapAnalysis;
}

export interface GapAnalysis {
  topics_with_gaps: Array<{
    topic: string;
    gap_count: number;
    coverage_percentage: number;
  }>;
  query_patterns: Array<{
    pattern: string;
    frequency: number;
    has_answer: boolean;
  }>;
}

export interface HealthFilter {
  type?: AlertType[];
  severity?: AlertSeverity[];
  status?: AlertStatus[];
  search?: string;
}
