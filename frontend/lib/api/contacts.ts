/**
 * Contacts API client
 * Wraps /api/contacts/* endpoints — uses apiClient (Axios) for auto token refresh
 */

import { apiClient } from '@/lib/api';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  tags: string[];
  points: number;
  lastActive: string | null;
}

export interface ContactsListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}

export interface ContactCreateData {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
  tags?: string[];
}

export type ContactUpdateData = Partial<ContactCreateData>;

export async function listContacts(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ContactsListResponse> {
  const res = await apiClient.get<ContactsListResponse>('/api/contacts', { params });
  return res.data;
}

export async function getContact(id: string): Promise<Contact> {
  const res = await apiClient.get<Contact>(`/api/contacts/${id}`);
  return res.data;
}

export async function createContact(data: ContactCreateData): Promise<Contact> {
  const res = await apiClient.post<Contact>('/api/contacts', data);
  return res.data;
}

export async function updateContact(
  id: string,
  data: ContactUpdateData
): Promise<Contact> {
  const res = await apiClient.patch<Contact>(`/api/contacts/${id}`, data);
  return res.data;
}

export async function deleteContact(id: string): Promise<void> {
  await apiClient.delete(`/api/contacts/${id}`);
}
