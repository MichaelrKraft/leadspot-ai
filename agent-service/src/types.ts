/**
 * LeadSpot Agent Service - Shared Types
 *
 * Core type definitions used across all agent service modules.
 */

// ============================================================================
// CRM Entity Types
// ============================================================================

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  tags?: string[];
  score?: number;
  lastActivity?: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  contactId: string;
  stage: string;
  value?: number;
  lastUpdated: string;
  createdAt: string;
}

// ============================================================================
// Agent Types
// ============================================================================

export type TaskComplexity = 'simple' | 'standard' | 'complex';

export type CRMAction =
  | 'pipeline_brief'
  | 'follow_up_check'
  | 'lead_score_decay'
  | 'stalled_deal_alert'
  | 'nurture_drip'
  | 'weekly_report'
  | 'expired_claim_check'
  | 'auto_pond_check'
  | 'auto_resume_check'
  | 'process_action_plans'
  | 'custom';

export interface AgentSuggestion {
  id: string;
  type: 'email' | 'call' | 'sms' | 'tag' | 'note' | 'campaign';
  contactId: string;
  title: string;
  description: string;
  draft?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'dismissed' | 'executed';
  createdAt: string;
  executedAt?: string;
  organizationId: string;
}

export interface PipelineBrief {
  id: string;
  organizationId: string;
  generatedAt: string;
  summary: string;
  newLeads: number;
  followUpsNeeded: number;
  dealsAtRisk: number;
  campaignHighlights: string[];
  suggestedActions: AgentSuggestion[];
}

// ============================================================================
// Cron Types (adapted from Johnny5)
// ============================================================================

export type CronSchedule =
  | { kind: 'at'; atMs: number }
  | { kind: 'every'; everyMs: number }
  | { kind: 'cron'; expr: string; tz?: string };

export interface CronPayload {
  message: string;
  action?: CRMAction;
  deliver?: boolean;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: CronSchedule;
  payload: CronPayload;
  enabled: boolean;
  organizationId: string;
  createdAt: number;
  lastRun?: number;
  nextRun?: number;
  deleteAfterRun?: boolean;
}

export interface CronRunRecord {
  timestamp: number;
  status: 'success' | 'failed';
  durationMs: number;
  error?: string;
}

// ============================================================================
// Task Router Types (adapted from Johnny5)
// ============================================================================

export interface TaskClassification {
  crewMember: string;
  complexity: TaskComplexity;
  confidence: number;
  parallelCandidates?: string[];
  reasoning?: string;
}

export interface CrewMemberSpec {
  id: string;
  name: string;
  category: string;
  description: string;
  keywords: string[];
}

// ============================================================================
// Memory Types (adapted from Johnny5)
// ============================================================================

export interface ExtractedFact {
  type: 'personal' | 'preference' | 'project' | 'technical' | 'goal' | 'interaction';
  key: string;
  value: string;
  confidence: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ExistingFact {
  fact_key: string;
  fact_value: string;
}

export interface MemoryContext {
  facts: ExtractedFact[];
  recentInteractions: string[];
  suggestions: string[];
}

// ============================================================================
// API Types
// ============================================================================

export interface AgentBriefRequest {
  organizationId: string;
  userId?: string;
}

export interface AgentSuggestionRequest {
  organizationId: string;
  contactId: string;
}

export interface AgentQueueRequest {
  organizationId: string;
  limit?: number;
  status?: AgentSuggestion['status'];
}

export interface AgentApproveRequest {
  organizationId: string;
  suggestionId: string;
  edited?: boolean;
  editedDraft?: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface AgentServiceConfig {
  port: number;
  dataDir: string;
  anthropicApiKey: string;
  leadspotApiUrl: string;
  defaultTimezone: string;
}

export const DEFAULT_CONFIG: Partial<AgentServiceConfig> = {
  port: 3008,
  defaultTimezone: 'America/Los_Angeles',
};
