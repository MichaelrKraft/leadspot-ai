/**
 * Reports API client
 * Wraps /api/reports/summary — uses apiClient (Axios) for auto token refresh
 */

import { apiClient } from '@/lib/api';

export interface CampaignPerformance {
  name: string;
  leads: number;
  opened: number;
  replied: number;
  open_rate: number;
}

export interface TopSegment {
  name: string;
  contacts: number;
}

export interface ReportsSummary {
  total_contacts: number;
  active_campaigns: number;
  total_deals: number;
  pipeline_value: number;
  campaigns_performance: CampaignPerformance[];
  top_segments: TopSegment[];
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  const res = await apiClient.get<ReportsSummary>('/api/reports/summary');
  return res.data;
}
