/**
 * Contacts API client
 * Wraps /api/contacts/* endpoints — uses httpOnly cookie auth (credentials: "include")
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listContacts(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ContactsListResponse> {
  const url = new URL(`${API_URL}/api/contacts`);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.search) url.searchParams.set('search', params.search);

  const res = await fetch(url.toString(), { credentials: 'include' });
  return handleResponse<ContactsListResponse>(res);
}

export async function getContact(id: string): Promise<Contact> {
  const res = await fetch(`${API_URL}/api/contacts/${id}`, {
    credentials: 'include',
  });
  return handleResponse<Contact>(res);
}

export async function createContact(data: ContactCreateData): Promise<Contact> {
  const res = await fetch(`${API_URL}/api/contacts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Contact>(res);
}

export async function updateContact(
  id: string,
  data: ContactUpdateData
): Promise<Contact> {
  const res = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Contact>(res);
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
}
