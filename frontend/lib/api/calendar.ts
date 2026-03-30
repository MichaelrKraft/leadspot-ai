/**
 * Calendar API service
 * Wraps /api/calendar/* endpoints
 */

import { useAuthStore } from '@/stores/useAuthStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface CalendarEventAPI {
  id: string;
  title: string;
  start: string;   // ISO datetime
  end: string;     // ISO datetime
  type: 'call' | 'meeting' | 'demo' | 'task';
  contact_id: string | null;
  contact_name: string | null;
  agent_id: string | null;
  notes: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface BookingRequest {
  agent_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  start: string;
  end: string;
  notes?: string;
}

export interface BookingResponse {
  id: string;
  title: string;
  start: string;
  end: string;
  message: string;
}

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listEvents(start: string, end: string): Promise<CalendarEventAPI[]> {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${BASE_URL}/api/calendar/events?${params}`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  const data = await res.json();
  return data.events as CalendarEventAPI[];
}

export async function createEvent(data: Partial<CalendarEventAPI>): Promise<CalendarEventAPI> {
  const res = await fetch(`${BASE_URL}/api/calendar/events`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  return res.json() as Promise<CalendarEventAPI>;
}

export async function updateEvent(id: string, data: Partial<CalendarEventAPI>): Promise<CalendarEventAPI> {
  const res = await fetch(`${BASE_URL}/api/calendar/events/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
  return res.json() as Promise<CalendarEventAPI>;
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/calendar/events/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`);
}

export async function getAvailability(agentId: string): Promise<AvailabilitySlot[]> {
  const res = await fetch(`${BASE_URL}/api/calendar/availability/${agentId}`);
  if (!res.ok) throw new Error(`Failed to fetch availability: ${res.status}`);
  const data = await res.json();
  return data.slots as AvailabilitySlot[];
}

export async function bookAppointment(data: BookingRequest): Promise<BookingResponse> {
  const res = await fetch(`${BASE_URL}/api/calendar/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to book appointment: ${res.status}`);
  return res.json() as Promise<BookingResponse>;
}
