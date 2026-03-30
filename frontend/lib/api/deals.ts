/**
 * Deals API service
 * Wraps /api/deals/* endpoints — requires JWT auth via Bearer token
 */

import { useAuthStore } from '@/stores/useAuthStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function listDeals(): Promise<ApiDeal[]> {
  const res = await fetch(`${BASE_URL}/api/deals`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  const data = await handleResponse<{ deals: ApiDeal[] }>(res);
  return data.deals;
}

export async function createDeal(data: Partial<ApiDeal>): Promise<ApiDeal> {
  const res = await fetch(`${BASE_URL}/api/deals`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse<ApiDeal>(res);
}

export async function updateDeal(id: string, data: Partial<ApiDeal>): Promise<ApiDeal> {
  const res = await fetch(`${BASE_URL}/api/deals/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse<ApiDeal>(res);
}

export async function deleteDeal(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/deals/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<void>(res);
}
