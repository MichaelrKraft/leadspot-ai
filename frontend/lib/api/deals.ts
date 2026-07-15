/**
 * Deals API service
 * Wraps /api/deals/* endpoints via apiClient (cookie/Bearer auth + CSRF header)
 */

import { apiClient } from '@/lib/api';

export interface ApiDeal {
  id: string;
  title: string;
  contact_id: string | null;
  contact_name: string | null;
  value: number;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export async function listDeals(): Promise<ApiDeal[]> {
  const res = await apiClient.get<{ deals: ApiDeal[] }>('/api/deals');
  return res.data.deals;
}

export async function createDeal(data: Partial<ApiDeal>): Promise<ApiDeal> {
  const res = await apiClient.post<ApiDeal>('/api/deals', data);
  return res.data;
}

export async function updateDeal(id: string, data: Partial<ApiDeal>): Promise<ApiDeal> {
  const res = await apiClient.patch<ApiDeal>(`/api/deals/${id}`, data);
  return res.data;
}

export async function deleteDeal(id: string): Promise<void> {
  await apiClient.delete(`/api/deals/${id}`);
}
