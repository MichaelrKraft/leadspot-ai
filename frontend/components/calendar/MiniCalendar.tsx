'use client';

import { useState, useMemo } from 'react';
import {
  CalendarEvent,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
} from '@/types/calendar';

interface MiniCalendarProps {
  events: CalendarEvent[];
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const MINI_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export default function MiniCalendar({
  events,
  selectedDate,
  onDateClick,
  onEventClick,
}: MiniCalendarProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!map.has(event.date)) {
        map.set(event.date, []);
      }
      map.get(event.date)!.push(event);
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const result: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      result.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(year, month, d));
    }
    while (result.length % 7 !== 0) {
      result.push(null);
    }
    return result;
  }, [year, month]);

  // Get upcoming events sorted by date, then time
  const upcomingEvents = useMemo(() => {
    const todayKey = formatDateKey(today);
    return events
      .filter((e) => e.date >= todayKey && e.status === 'scheduled')
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 5);
  }, [events, today]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthLabel = currentDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Mini Calendar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={goToPrevMonth}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
            aria-label="Previous month"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {monthLabel}
          </span>
          <button
            onClick={goToNextMonth}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
            aria-label="Next month"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="mb-1 grid grid-cols-7 gap-0">
          {MINI_DAYS.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="py-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="py-1" />;
            }

            const dateKey = formatDateKey(date);
            const hasEvents = eventsByDate.has(dateKey);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

            return (
              <button
                key={dateKey}
                onClick={() => onDateClick(date)}
                className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                  isToday
                    ? 'bg-primary-500 font-bold text-white'
                    : isSelected
                    ? 'bg-primary-100 font-medium text-primary-700 dark:bg-primary-500/20 dark:text-primary-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                }`}
              >
                {date.getDate()}
                {hasEvents && !isToday && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Upcoming Events
        </h3>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No upcoming events
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
              const colors = EVENT_TYPE_COLORS[event.type];
              const eventDate = new Date(event.date + 'T00:00:00');
              const isEventToday = isSameDay(eventDate, today);

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isEventToday ? 'Today' : eventDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                      {' '}
                      {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </p>
                    {event.contactName && (
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {event.contactName}
                      </p>
                    )}
                  </div>
                  <span className={`mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                    {EVENT_TYPE_LABELS[event.type]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
