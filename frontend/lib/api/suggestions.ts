/**
 * Deal suggestions API service — AI-proposed stage changes pending review.
 */

import { apiClient } from '@/lib/api';

export interface SuggestionSource {
  subject: string | null;
  from_address: string | null;
  body_preview: string | null;
  received_at: string | null;
}

export interface DealSuggestion {
  id: string;
  deal_id: string;
  deal_title: string | null;
  property_name: string | null;
  current_stage: string;
  suggested_stage: string;
  confidence: number;
  evidence: string | null;
  source_type: 'email' | 'document';
  source: SuggestionSource | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export async function listSuggestions(status = 'pending'): Promise<DealSuggestion[]> {
  const res = await apiClient.get<{ suggestions: DealSuggestion[] }>(
    `/api/deals/suggestions?status_filter=${status}`
  );
  return res.data.suggestions;
}

export async function acceptSuggestion(id: string): Promise<DealSuggestion> {
  const res = await apiClient.post<DealSuggestion>(`/api/deals/suggestions/${id}/accept`);
  return res.data;
}

export async function rejectSuggestion(id: string): Promise<DealSuggestion> {
  const res = await apiClient.post<DealSuggestion>(`/api/deals/suggestions/${id}/reject`);
  return res.data;
}
