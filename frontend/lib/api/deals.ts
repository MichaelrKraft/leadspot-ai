/**
 * Deals API service
 * Wraps /api/deals/* endpoints via apiClient (cookie/Bearer auth + CSRF header)
 */

import { apiClient } from '@/lib/api';
import type { Pipeline } from '@/types/deals';

export interface ApiDeal {
  id: string;
  title: string;
  contact_id: string | null;
  contact_name: string | null;
  value: number;
  pipeline: Pipeline;
  stage: string;
  priority: 'low' | 'medium' | 'high';
  property_name: string | null;
  stage_changed_at: string | null;
  notes: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApiStageDefinition {
  id: string;
  name: string;
  color: string;
}

export async function listDeals(pipeline: Pipeline = 'sales'): Promise<ApiDeal[]> {
  const res = await apiClient.get<{ deals: ApiDeal[] }>(`/api/deals?pipeline=${pipeline}`);
  return res.data.deals;
}

export async function listStages(pipeline: Pipeline = 'sales'): Promise<ApiStageDefinition[]> {
  const res = await apiClient.get<ApiStageDefinition[]>(`/api/deals/stages?pipeline=${pipeline}`);
  return res.data;
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
