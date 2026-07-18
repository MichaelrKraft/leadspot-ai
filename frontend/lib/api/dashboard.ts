/**
 * Dashboard API service
 * Wraps /api/insights/* endpoints. /insights/daily derives data from the
 * authenticated user's session (no query params needed). /insights/hot-leads
 * and /insights/stats are still Mautic-only and unused by the dashboard page.
 */

import { apiClient } from '@/lib/api';

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

export async function fetchDailyInsights(): Promise<DailyInsightsResponse> {
  const res = await apiClient.get<DailyInsightsResponse>('/api/insights/daily', {
    timeout: 10000,
  });
  return res.data;
}
