/**
 * Agent Service API client
 * Wraps /api/agent/* endpoints for smart lists, pipeline briefs,
 * timeline, approval queue, and action plans.
 */

const API_URL = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:3008';
const ORG_ID = 'demo-org'; // TODO: get from auth context

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
  email: string;
  phone: string;
  company: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  suggestedAction: string;
  leadScore: number;
  daysSinceLastContact: number;
  actedUpon: boolean;
}

export interface SmartListResult {
  list: SmartList;
  contacts: SmartListContact[];
  total: number;
  actedCount: number;
}

export async function fetchSmartLists(): Promise<SmartList[]> {
  const res = await fetch(
    `${API_URL}/api/agent/smart-lists?organizationId=${encodeURIComponent(ORG_ID)}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.lists || data;
}

export async function evaluateSmartList(listId: string): Promise<SmartListResult> {
  const res = await fetch(`${API_URL}/api/agent/smart-lists/${listId}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG_ID }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.result || data;
}

export async function markContactActedUpon(
  listId: string,
  contactId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/agent/smart-lists/${listId}/mark-acted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG_ID, contactId }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---- Pipeline Brief ----

export interface PipelineBrief {
  summary: string;
  hotLeads: number;
  stalledDeals: number;
  generatedAt: string;
}

export async function fetchPipelineBrief(): Promise<PipelineBrief> {
  const res = await fetch(`${API_URL}/api/agent/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG_ID }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
  const res = await fetch(
    `${API_URL}/api/agent/timeline/${contactId}?organizationId=${encodeURIComponent(ORG_ID)}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchTimelineSummary(contactId: string): Promise<TimelineSummary> {
  const res = await fetch(
    `${API_URL}/api/agent/timeline/${contactId}/summary?organizationId=${encodeURIComponent(ORG_ID)}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
  const res = await fetch(
    `${API_URL}/api/agent/queue?organizationId=${encodeURIComponent(ORG_ID)}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function approveAction(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/agent/queue/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG_ID }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function dismissAction(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/agent/queue/${id}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG_ID }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
  const res = await fetch(
    `${API_URL}/api/agent/action-plans?organizationId=${encodeURIComponent(ORG_ID)}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---- Recent Activity ----

export async function fetchRecentActivity(): Promise<TimelineEvent[]> {
  const res = await fetch(
    `${API_URL}/api/agent/timeline/recent?organizationId=${encodeURIComponent(ORG_ID)}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
