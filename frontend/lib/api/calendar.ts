/**
 * Calendar API service
 * Wraps /api/calendar/* endpoints via apiClient (cookie/Bearer auth + CSRF header)
 */

import { apiClient } from '@/lib/api';

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

export async function listEvents(start: string, end: string): Promise<CalendarEventAPI[]> {
  const res = await apiClient.get<{ events: CalendarEventAPI[] }>('/api/calendar/events', {
    params: { start, end },
  });
  return res.data.events;
}

export async function createEvent(data: Partial<CalendarEventAPI>): Promise<CalendarEventAPI> {
  const res = await apiClient.post<CalendarEventAPI>('/api/calendar/events', data);
  return res.data;
}

export async function updateEvent(id: string, data: Partial<CalendarEventAPI>): Promise<CalendarEventAPI> {
  const res = await apiClient.patch<CalendarEventAPI>(`/api/calendar/events/${id}`, data);
  return res.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await apiClient.delete(`/api/calendar/events/${id}`);
}

// Public booking-page endpoints (no auth required server-side, but going
// through apiClient keeps the CSRF header for visitors who ARE logged in).

export async function getAvailability(agentId: string): Promise<AvailabilitySlot[]> {
  const res = await apiClient.get<{ slots: AvailabilitySlot[] }>(
    `/api/calendar/availability/${agentId}`
  );
  return res.data.slots;
}

export async function bookAppointment(data: BookingRequest): Promise<BookingResponse> {
  const res = await apiClient.post<BookingResponse>('/api/calendar/book', data);
  return res.data;
}
