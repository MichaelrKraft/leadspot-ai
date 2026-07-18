/**
 * Agent Service API client
 * Wraps /api/agent/* endpoints for smart lists, pipeline briefs,
 * timeline, approval queue, and action plans.
 */

import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import type { PipelineBrief } from '@/lib/dashboard-demo-data';

// Returns the current org ID from auth context, falls back to 'demo-org' in dev mode
function getOrgId(): string {
  return useAuthStore.getState().user?.organizationId ?? 'demo-org';
}

// ---- Smart Lists ----

export interface SmartListRule {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface SmartList {
  id: string;
  name: string;
  description: string;
  rules: SmartListRule[];
  sortBy: string;
  sortOrder: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartListContact {
  contactId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  company: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  suggestedAction: string;
  leadScore: number;
  score?: number;
  daysSinceLastContact: number;
  lastContactDays?: number;
  actedUpon: boolean;
}

export interface SmartListResult {
  list: SmartList;
  contacts: SmartListContact[];
  total: number;
  actedCount: number;
  completedToday?: number;
}

export async function fetchSmartLists(): Promise<SmartList[]> {
  const res = await apiClient.get('/api/agent/smart-lists', {
    params: { organizationId: getOrgId() },
  });
  return res.data.lists || res.data;
}

export async function evaluateSmartList(listId: string): Promise<SmartListResult> {
  const res = await apiClient.post(`/api/agent/smart-lists/${listId}/evaluate`, {
    organizationId: getOrgId(),
  });
  return res.data.result || res.data;
}

export async function markContactActedUpon(
  listId: string,
  contactId: string
): Promise<{ success: boolean }> {
  const res = await apiClient.post(`/api/agent/smart-lists/${listId}/mark-acted`, {
    organizationId: getOrgId(),
    contactId,
  });
  return res.data;
}

// ---- Pipeline Brief ----

// Matches agent-service's PipelineBrief (agent-service/src/types.ts)
interface PipelineBriefApiResponse {
  brief: {
    generatedAt: string;
    summary: string;
    newLeads: number;
    followUpsNeeded: number;
    dealsAtRisk: number;
    suggestedActions: { id: string; title: string; description: string }[];
  };
}

export async function fetchPipelineBrief(): Promise<PipelineBrief> {
  const res = await apiClient.post<PipelineBriefApiResponse>('/api/agent/brief', {
    organizationId: getOrgId(),
  });
  const brief = res.data.brief;
  return {
    greeting: "Here's your AI morning brief",
    summary: brief.summary,
    new_leads: brief.newLeads,
    follow_ups_needed: brief.followUpsNeeded,
    deals_at_risk: brief.dealsAtRisk,
    suggested_actions: brief.suggestedActions,
  };
}

// ---- Timeline ----

export interface TimelineEvent {
  id: string;
  contactId: string;
  type: string;
  title: string;
  description: string;
  source: string;
  createdAt: string;
}

export interface TimelineSummary {
  totalEvents: number;
  lastActivity: string;
  channels: Record<string, number>;
  summary: string;
}

export async function fetchTimeline(contactId: string): Promise<TimelineEvent[]> {
  const res = await apiClient.get(`/api/agent/timeline/${contactId}`, {
    params: { organizationId: getOrgId() },
  });
  return res.data;
}

export async function fetchTimelineSummary(contactId: string): Promise<TimelineSummary> {
  const res = await apiClient.get(`/api/agent/timeline/${contactId}/summary`, {
    params: { organizationId: getOrgId() },
  });
  return res.data;
}

// ---- Approval Queue ----

export interface QueueItem {
  id: string;
  type: string;
  description: string;
  contactId: string;
  contactName: string;
  createdAt: string;
}

export async function fetchApprovalQueue(): Promise<QueueItem[]> {
  const res = await apiClient.get('/api/agent/queue', {
    params: { organizationId: getOrgId() },
  });
  return res.data;
}

export async function approveAction(id: string): Promise<{ success: boolean }> {
  const res = await apiClient.post(`/api/agent/queue/${id}/approve`, {
    organizationId: getOrgId(),
  });
  return res.data;
}

export async function dismissAction(id: string): Promise<{ success: boolean }> {
  const res = await apiClient.post(`/api/agent/queue/${id}/dismiss`, {
    organizationId: getOrgId(),
  });
  return res.data;
}

// ---- Action Plans ----

export interface ActionPlan {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  isActive: boolean;
  createdAt: string;
}

export async function fetchActionPlans(): Promise<ActionPlan[]> {
  const res = await apiClient.get('/api/agent/action-plans', {
    params: { organizationId: getOrgId() },
  });
  return res.data;
}

// ---- Recent Activity ----

export async function fetchRecentActivity(): Promise<TimelineEvent[]> {
  const res = await apiClient.get('/api/agent/timeline/recent', {
    params: { organizationId: getOrgId() },
  });
  return res.data;
}
