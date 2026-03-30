'use client';

import { useState, useCallback, useEffect } from 'react';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import MiniCalendar from '@/components/calendar/MiniCalendar';
import EventModal from '@/components/calendar/EventModal';
import { CalendarEvent } from '@/types/calendar';
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent as deleteEventAPI,
  CalendarEventAPI,
} from '@/lib/api/calendar';

// ---------------------------------------------------------------------------
// Adapters between API shape and local CalendarEvent shape
// ---------------------------------------------------------------------------

function apiEventToLocal(e: CalendarEventAPI): CalendarEvent {
  const start = new Date(e.start);
  const end = new Date(e.end);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: e.id,
    title: e.title,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    type: (e.type as CalendarEvent['type']) ?? 'call',
    contactName: e.contact_name ?? undefined,
    notes: e.notes ?? undefined,
    status: 'scheduled',
  };
}

function localEventToAPI(e: CalendarEvent): Partial<CalendarEventAPI> {
  const startISO = `${e.date}T${e.startTime}:00`;
  const endISO = `${e.date}T${e.endTime}:00`;
  return {
    title: e.title,
    start: startISO,
    end: endISO,
    type: e.type as CalendarEventAPI['type'],
    contact_name: e.contactName ?? null,
    notes: e.notes ?? null,
    contact_id: null,
    agent_id: null,
  };
}

// ---------------------------------------------------------------------------

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return formatDateKey(d);
}


export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Fetch events for the visible month window
  const fetchEvents = useCallback(async (referenceDate: Date) => {
    setIsLoading(true);
    try {
      const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59);
      const apiEvents = await listEvents(start.toISOString(), end.toISOString());
      setEvents(apiEvents.map(apiEventToLocal));
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(selectedDate ?? new Date());
  }, [fetchEvents, selectedDate?.getMonth(), selectedDate?.getFullYear()]);

  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setModalOpen(true);
  }, []);

  const handleNewEvent = useCallback(() => {
    setEditingEvent(null);
    setModalOpen(true);
  }, []);

  const handleSaveEvent = useCallback(async (event: CalendarEvent) => {
    try {
      const payload = localEventToAPI(event);
      if (event.id && events.some((e) => e.id === event.id)) {
        const updated = await updateEvent(event.id, payload);
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? apiEventToLocal(updated) : e))
        );
      } else {
        const created = await createEvent(payload);
        setEvents((prev) => [...prev, apiEventToLocal(created)]);
      }
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  }, [events]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    try {
      await deleteEventAPI(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }, []);

  const defaultDate = selectedDate ? formatDateKey(selectedDate) : undefined;

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your calls, meetings, and follow-ups
          </p>
        </div>
        <button
          onClick={handleNewEvent}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/20 transition-colors hover:from-primary-600 hover:to-primary-500"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">Loading events…</div>
      )}

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="min-w-0 flex-1">
          <CalendarGrid
            events={events}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            selectedDate={selectedDate}
          />
        </div>

        {/* Sidebar */}
        <div className="hidden w-72 flex-shrink-0 xl:block">
          <MiniCalendar
            events={events}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        event={editingEvent}
        defaultDate={defaultDate}
      />
    </div>
  );
}
