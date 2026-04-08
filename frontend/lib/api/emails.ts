/**
 * Emails API client
 * Wraps /api/emails/* endpoints — uses apiClient (Axios) for auto token refresh
 */

import { apiClient } from '@/lib/api';

export interface Email {
  id: string;
  subject: string;
  status: string;
  from_addr: string;
  to_addr: string;
  body: string | null;
  email_type: string;
  opened: boolean;
  replied: boolean;
  sent_at: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface EmailsListResponse {
  emails: Email[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailCreateData {
  subject: string;
  from_addr: string;
  to_addr: string;
  body?: string;
  status?: string;
  email_type?: string;
  opened?: boolean;
  replied?: boolean;
  sent_at?: string | null;
}

export type EmailUpdateData = Partial<EmailCreateData>;

export async function listEmails(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<EmailsListResponse> {
  const res = await apiClient.get<EmailsListResponse>('/api/emails', { params });
  return res.data;
}

export async function createEmail(data: EmailCreateData): Promise<Email> {
  const res = await apiClient.post<Email>('/api/emails', data);
  return res.data;
}

export async function updateEmail(id: string, data: EmailUpdateData): Promise<Email> {
  const res = await apiClient.patch<Email>(`/api/emails/${id}`, data);
  return res.data;
}

export async function deleteEmail(id: string): Promise<void> {
  await apiClient.delete(`/api/emails/${id}`);
}
