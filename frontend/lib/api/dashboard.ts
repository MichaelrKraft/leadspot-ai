/**
 * Dashboard API service
 * Wraps /api/insights/* endpoints (public, no auth required)
 */

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

export async function fetchDailyInsights(
  mauticUrl = 'http://localhost'
): Promise<DailyInsightsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(
      `/api/insights/daily?mautic_url=${encodeURIComponent(mauticUrl)}`,
      { signal: controller.signal }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchHotLeads(limit = 5): Promise<HotLead[]> {
  const res = await fetch(
    `/api/insights/hot-leads?limit=${limit}&mautic_url=${encodeURIComponent('http://localhost')}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.hot_leads;
}

export async function fetchCRMStats(): Promise<SummaryStats> {
  const res = await fetch(
    `/api/insights/stats?mautic_url=${encodeURIComponent('http://localhost')}`
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.stats;
}
