'use client';

import { useState, useCallback } from 'react';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import MiniCalendar from '@/components/calendar/MiniCalendar';
import EventModal from '@/components/calendar/EventModal';
import { CalendarEvent } from '@/types/calendar';

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

const DEMO_EVENTS: CalendarEvent[] = [
  {
    id: 'evt_001',
    title: 'Discovery Call - Acme Corp',
    date: getDateOffset(0),
    startTime: '09:00',
    endTime: '09:30',
    type: 'call',
    contactName: 'Sarah Chen',
    contactEmail: 'sarah@acmecorp.com',
    notes: 'Initial discovery call to discuss their CRM needs',
    status: 'scheduled',
  },
  {
    id: 'evt_002',
    title: 'Team Standup',
    date: getDateOffset(0),
    startTime: '10:00',
    endTime: '10:15',
    type: 'meeting',
    notes: 'Daily sync with sales team',
    status: 'scheduled',
  },
  {
    id: 'evt_003',
    title: 'Follow up with TechStart',
    date: getDateOffset(1),
    startTime: '11:00',
    endTime: '11:30',
    type: 'follow-up',
    contactName: 'Mike Johnson',
    contactEmail: 'mike@techstart.io',
    notes: 'Send updated proposal and pricing',
    status: 'scheduled',
  },
  {
    id: 'evt_004',
    title: 'Demo - DataFlow Inc',
    date: getDateOffset(1),
    startTime: '14:00',
    endTime: '15:00',
    type: 'meeting',
    contactName: 'Lisa Park',
    contactEmail: 'lisa@dataflow.com',
    notes: 'Product demo for their marketing team',
    status: 'scheduled',
  },
  {
    id: 'evt_005',
    title: 'Proposal Deadline - CloudNine',
    date: getDateOffset(2),
    startTime: '17:00',
    endTime: '17:00',
    type: 'deadline',
    contactName: 'James Wright',
    contactEmail: 'james@cloudnine.dev',
    notes: 'Submit final proposal by EOD',
    status: 'scheduled',
  },
  {
    id: 'evt_006',
    title: 'Check-in Call - BrightEdge',
    date: getDateOffset(3),
    startTime: '10:00',
    endTime: '10:30',
    type: 'call',
    contactName: 'Emma Davis',
    contactEmail: 'emma@brightedge.co',
    status: 'scheduled',
  },
  {
    id: 'evt_007',
    title: 'Strategy Meeting',
    date: getDateOffset(3),
    startTime: '13:00',
    endTime: '14:00',
    type: 'meeting',
    notes: 'Q2 planning with leadership',
    status: 'scheduled',
  },
  {
    id: 'evt_008',
    title: 'Follow up - NexGen Labs',
    date: getDateOffset(5),
    startTime: '09:30',
    endTime: '10:00',
    type: 'follow-up',
    contactName: 'Alex Rivera',
    contactEmail: 'alex@nexgenlabs.com',
    notes: 'Review contract terms',
    status: 'scheduled',
  },
  {
    id: 'evt_009',
    title: 'Onboarding Call - FreshStart',
    date: getDateOffset(6),
    startTime: '11:00',
    endTime: '12:00',
    type: 'call',
    contactName: 'Taylor Kim',
    contactEmail: 'taylor@freshstart.io',
    notes: 'New client onboarding and setup',
    status: 'scheduled',
  },
  {
    id: 'evt_010',
    title: 'Contract Review Deadline',
    date: getDateOffset(7),
    startTime: '12:00',
    endTime: '12:00',
    type: 'deadline',
    contactName: 'Jordan Lee',
    contactEmail: 'jordan@synapse.ai',
    notes: 'Legal review must be completed',
    status: 'scheduled',
  },
  {
    id: 'evt_011',
    title: 'Product Demo - Zenith Co',
    date: getDateOffset(-1),
    startTime: '15:00',
    endTime: '16:00',
    type: 'meeting',
    contactName: 'Priya Sharma',
    contactEmail: 'priya@zenithco.com',
    status: 'completed',
  },
  {
    id: 'evt_012',
    title: 'Sales Pipeline Review',
    date: getDateOffset(4),
    startTime: '16:00',
    endTime: '16:30',
    type: 'meeting',
    notes: 'Weekly pipeline review with sales manager',
    status: 'scheduled',
  },
  {
    id: 'evt_013',
    title: 'Cold Call Block',
    date: getDateOffset(2),
    startTime: '09:00',
    endTime: '10:30',
    type: 'call',
    notes: 'Outbound prospecting session',
    status: 'scheduled',
  },
  {
    id: 'evt_014',
    title: 'Follow up - Summit Group',
    date: getDateOffset(8),
    startTime: '14:00',
    endTime: '14:30',
    type: 'follow-up',
    contactName: 'Chris Nguyen',
    contactEmail: 'chris@summitgroup.com',
    notes: 'Check on decision timeline',
    status: 'scheduled',
  },
  {
    id: 'evt_015',
    title: 'Quarterly Report Due',
    date: getDateOffset(10),
    startTime: '09:00',
    endTime: '09:00',
    type: 'deadline',
    notes: 'Submit Q1 sales report',
    status: 'scheduled',
  },
];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(DEMO_EVENTS);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

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

  const handleSaveEvent = useCallback((event: CalendarEvent) => {
    setEvents((prev) => {
      const existing = prev.findIndex((e) => e.id === event.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = event;
        return updated;
      }
      return [...prev, event];
    });
  }, []);

  const handleDeleteEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
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
