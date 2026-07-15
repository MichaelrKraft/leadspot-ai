/**
 * Dashboard API service
 * Wraps /api/insights/* endpoints. The backend derives data from the
 * organization when organization_id is supplied (it is preferred over the
 * mautic_url lookup), so we pass the authenticated org id rather than a
 * hardcoded localhost URL that never matched a real Mautic instance.
 */

import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';

export interface HotLead {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  points: number;
  last_active: string;
}

export interface SummaryStats {
  total_contacts: number;
  total_emails: number;
  total_campaigns: number;
  total_segments: number;
}

export interface DailyInsightsResponse {
  hot_leads: HotLead[];
  stats: SummaryStats;
  ai_insights: string;
  mautic_connected: boolean;
  generated_at: string;
}

// mautic_url is a required query param on the backend but is ignored when
// organization_id resolves; send a harmless placeholder alongside the real org.
function insightsParams(extra: Record<string, unknown> = {}) {
  const orgId = useAuthStore.getState().user?.organizationId;
  return { mautic_url: 'https://unused.invalid', organization_id: orgId, ...extra };
}

export async function fetchDailyInsights(): Promise<DailyInsightsResponse> {
  const res = await apiClient.get<DailyInsightsResponse>('/api/insights/daily', {
    params: insightsParams(),
    timeout: 10000,
  });
  return res.data;
}

export async function fetchHotLeads(limit = 5): Promise<HotLead[]> {
  const res = await apiClient.get<{ hot_leads: HotLead[] }>('/api/insights/hot-leads', {
    params: insightsParams({ limit }),
  });
  return res.data.hot_leads;
}

export async function fetchCRMStats(): Promise<SummaryStats> {
  const res = await apiClient.get<{ stats: SummaryStats }>('/api/insights/stats', {
    params: insightsParams(),
  });
  return res.data.stats;
}
