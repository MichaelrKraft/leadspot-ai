'use client';

import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, EventContentArg } from '@fullcalendar/core';

interface Event {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  meetingUrl: string | null;
  maxAttendees: number | null;
  host: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  _count: {
    attendees: number;
  };
}

interface EventsCalendarProps {
  events: Event[];
  onEventClick: (event: Event) => void;
}

export default function EventsCalendar({ events, onEventClick }: EventsCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);

  // Transform events for FullCalendar
  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startTime,
    end: event.endTime || event.startTime,
    extendedProps: {
      description: event.description,
      meetingUrl: event.meetingUrl,
      maxAttendees: event.maxAttendees,
      host: event.host,
      attendeeCount: event._count.attendees,
      fullEvent: event,
    },
    backgroundColor: '#00D9FF',
    borderColor: '#00D9FF',
    textColor: '#0a0a0a',
  }));

  const handleEventClick = (clickInfo: EventClickArg) => {
    const fullEvent = clickInfo.event.extendedProps.fullEvent as Event;
    onEventClick(fullEvent);
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { attendeeCount, maxAttendees } = eventInfo.event.extendedProps;
    const isFull = maxAttendees && attendeeCount >= maxAttendees;

    return (
      <div className="p-1 overflow-hidden">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-xs truncate">{eventInfo.event.title}</span>
          {isFull && (
            <span className="text-[10px] bg-accent-red text-white px-1 rounded">FULL</span>
          )}
        </div>
        <div className="text-[10px] opacity-90">
          {eventInfo.timeText}
          {maxAttendees && (
            <span className="ml-1">
              ({attendeeCount}/{maxAttendees})
            </span>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Apply custom styling to calendar
    const style = document.createElement('style');
    style.textContent = `
      .fc {
        background-color: #141414;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #2a2a2a;
      }
      .fc-theme-standard .fc-scrollgrid {
        border-color: #2a2a2a;
      }
      .fc-theme-standard td,
      .fc-theme-standard th {
        border-color: #2a2a2a;
      }
      .fc .fc-toolbar-title {
        color: #ffffff;
        font-size: 1.5rem;
        font-weight: 600;
      }
      .fc .fc-button {
        background-color: #1a1a1a;
        border-color: #2a2a2a;
        color: #a0a0a0;
        text-transform: capitalize;
        padding: 0.5rem 1rem;
      }
      .fc .fc-button:hover {
        background-color: #00D9FF;
        border-color: #00D9FF;
        color: #0a0a0a;
      }
      .fc .fc-button-primary:not(:disabled):active,
      .fc .fc-button-primary:not(:disabled).fc-button-active {
        background-color: #00D9FF;
        border-color: #00D9FF;
        color: #0a0a0a;
      }
      .fc .fc-button:disabled {
        opacity: 0.5;
        background-color: #1a1a1a;
        border-color: #2a2a2a;
        color: #666;
      }
      .fc .fc-col-header-cell {
        background-color: #1a1a1a;
        border-color: #2a2a2a;
      }
      .fc .fc-col-header-cell-cushion {
        color: #a0a0a0;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75rem;
        padding: 0.75rem 0;
      }
      .fc .fc-daygrid-day-number {
        color: #ffffff;
        padding: 0.5rem;
        font-weight: 500;
      }
      .fc .fc-daygrid-day.fc-day-today {
        background-color: #00D9FF10 !important;
      }
      .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
        color: #00D9FF;
        font-weight: 700;
      }
      .fc .fc-daygrid-day:hover {
        background-color: #1a1a1a;
      }
      .fc .fc-event {
        border-radius: 4px;
        padding: 2px 4px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .fc .fc-event:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .fc .fc-daygrid-event-dot {
        display: none;
      }
      .fc-h-event .fc-event-main {
        color: inherit;
      }
      .fc .fc-daygrid-day-frame {
        background-color: #0a0a0a;
      }
      .fc .fc-scrollgrid-sync-inner {
        background-color: #0a0a0a;
      }
      .fc .fc-timegrid-slot {
        height: 3rem;
      }
      .fc .fc-timegrid-slot-label {
        color: #a0a0a0;
        font-size: 0.75rem;
      }
      .fc .fc-timegrid-axis-cushion {
        color: #a0a0a0;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-subtle overflow-hidden">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={calendarEvents}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        height="auto"
        editable={false}
        selectable={false}
        selectMirror={true}
        dayMaxEvents={3}
        moreLinkText={(num) => `+${num} more`}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        nowIndicator={true}
        weekends={true}
        firstDay={0}
      />
    </div>
  );
}
