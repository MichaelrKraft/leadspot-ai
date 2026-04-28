/**
 * Signals API client — Ghostlog auto-logged activity timeline.
 * Each signal is a redacted, sourced observation tied to a contact.
 */

import { apiClient } from '@/lib/api';

export type SignalState =
  | 'captured'
  | 'enriched'
  | 'matched'
  | 'queued'
  | 'promoted'
  | 'held'
  | 'dropped'
  | 'redacted';

export interface Signal {
  id: string;
  summary: string;
  source_app: string | null;
  extractor: string;
  observed_at: string;
  confidence: number;
  state: SignalState;
  ocr_snippet_hash: string | null;
}

export interface SignalsListResponse {
  signals: Signal[];
  next_before: string | null;
}

export async function listContactSignals(
  contactId: string,
  params?: { limit?: number; before?: string }
): Promise<SignalsListResponse> {
  const res = await apiClient.get<SignalsListResponse>(
    `/api/contacts/${contactId}/signals`,
    { params: { limit: params?.limit ?? 50, before: params?.before } }
  );
  return res.data;
}

export async function deleteSignal(signalId: string): Promise<void> {
  await apiClient.delete(`/api/signals/${signalId}`);
}
