/**
 * Segments API client
 * Wraps /api/segments/* endpoints — uses apiClient (Axios) for auto token refresh
 */

import { apiClient } from '@/lib/api';

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  color: string;
  contact_count: number;
  filter_type: string;
  filter_criteria: string | null;
  created_at: string;
  updated_at: string;
}

export interface SegmentsListResponse {
  segments: Segment[];
  total: number;
}

export interface SegmentCreateData {
  name: string;
  description?: string;
  color?: string;
  contact_count?: number;
  filter_type?: string;
  filter_criteria?: string;
}

export type SegmentUpdateData = Partial<SegmentCreateData>;

export async function listSegments(): Promise<SegmentsListResponse> {
  const res = await apiClient.get<SegmentsListResponse>('/api/segments');
  return res.data;
}

export async function createSegment(data: SegmentCreateData): Promise<Segment> {
  const res = await apiClient.post<Segment>('/api/segments', data);
  return res.data;
}

export async function updateSegment(id: string, data: SegmentUpdateData): Promise<Segment> {
  const res = await apiClient.patch<Segment>(`/api/segments/${id}`, data);
  return res.data;
}

export async function deleteSegment(id: string): Promise<void> {
  await apiClient.delete(`/api/segments/${id}`);
}
