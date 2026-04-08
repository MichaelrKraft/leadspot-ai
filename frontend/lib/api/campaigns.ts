/**
 * Campaigns API client
 * Wraps /api/campaigns/* endpoints — uses apiClient (Axios) for auto token refresh
 */

import { apiClient } from '@/lib/api';

export interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  leads: number;
  opened: number;
  replied: number;
  created_at: string;
}

export interface CampaignsListResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
}

export interface CampaignCreateData {
  name: string;
  type: string;
  status?: string;
}

export type CampaignUpdateData = Partial<CampaignCreateData>;

export async function listCampaigns(params?: {
  page?: number;
  limit?: number;
}): Promise<CampaignsListResponse> {
  const res = await apiClient.get<CampaignsListResponse>('/api/campaigns', { params });
  return res.data;
}

export async function createCampaign(data: CampaignCreateData): Promise<Campaign> {
  const res = await apiClient.post<Campaign>('/api/campaigns', data);
  return res.data;
}

export async function updateCampaign(
  id: string,
  data: CampaignUpdateData
): Promise<Campaign> {
  const res = await apiClient.patch<Campaign>(`/api/campaigns/${id}`, data);
  return res.data;
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiClient.delete(`/api/campaigns/${id}`);
}
