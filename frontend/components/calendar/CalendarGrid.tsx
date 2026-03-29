'use client';

import { useState, useMemo } from 'react';
import {
  CalendarEvent,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
} from '@/types/calendar';

interface CalendarGridProps {
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  selectedDate: Date | null;
}

type ViewMode = 'month' | 'week';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

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

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export default function CalendarGrid({
  events,
  onDateClick,
  onEventClick,
  selectedDate,
}: CalendarGridProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const monthDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: (Date | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    // Trailing empty cells to fill last row
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  }, [year, month]);

  const weekDates = useMemo(() => {
    return getWeekDates(selectedDate || today);
  }, [selectedDate, today]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToPrevWeek = () => {
    const d = new Date(weekDates[0]);
    d.setDate(d.getDate() - 7);
    onDateClick(d);
  };

  const goToNextWeek = () => {
    const d = new Date(weekDates[0]);
    d.setDate(d.getDate() + 7);
    onDateClick(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateClick(today);
  };

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const renderDayCell = (date: Date | null, index: number) => {
    if (!date) {
      return (
        <div
          key={`empty-${index}`}
          className="min-h-[100px] border border-gray-200 bg-gray-50 dark:border-gray-700/50 dark:bg-gray-800/30"
        />
      );
    }

    const dateKey = formatDateKey(date);
    const dayEvents = eventsByDate.get(dateKey) || [];
    const isToday = isSameDay(date, today);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

    return (
      <div
        key={dateKey}
        onClick={() => onDateClick(date)}
        className={`min-h-[100px] cursor-pointer border border-gray-200 p-1.5 transition-colors hover:bg-blue-50 dark:border-gray-700/50 dark:hover:bg-blue-500/5 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-white dark:bg-gray-800/50'
        }`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
              isToday
                ? 'bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {date.getDate()}
          </span>
          {dayEvents.length > 0 && (
            <span className="text-xs text-gray-400">{dayEvents.length}</span>
          )}
        </div>
        <div className="space-y-0.5">
          {dayEvents.slice(0, 3).map((event) => {
            const colors = EVENT_TYPE_COLORS[event.type];
            return (
              <button
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs ${colors.bg} ${colors.text} transition-opacity hover:opacity-80`}
              >
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${colors.dot}`} />
                <span className="truncate">{event.title}</span>
              </button>
            );
          })}
          {dayEvents.length > 3 && (
            <span className="block text-xs text-gray-400">
              +{dayEvents.length - 3} more
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

    return (
      <div className="overflow-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-0">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700" />
          {weekDates.map((date) => {
            const isToday = isSameDay(date, today);
            return (
              <div
                key={formatDateKey(date)}
                onClick={() => onDateClick(date)}
                className={`cursor-pointer border-b border-l border-gray-200 p-2 text-center dark:border-gray-700 ${
                  isToday ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                }`}
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {DAYS_OF_WEEK[date.getDay()]}
                </div>
                <div
                  className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}

          {/* Time slots */}
          {hours.map((hour) => (
            <>
              <div
                key={`label-${hour}`}
                className="border-b border-gray-200 pr-2 pt-1 text-right text-xs text-gray-400 dark:border-gray-700"
              >
                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
              </div>
              {weekDates.map((date) => {
                const dateKey = formatDateKey(date);
                const dayEvents = eventsByDate.get(dateKey) || [];
                const hourEvents = dayEvents.filter((e) => {
                  const eventHour = parseInt(e.startTime.split(':')[0], 10);
                  return eventHour === hour;
                });

                return (
                  <div
                    key={`${dateKey}-${hour}`}
                    className="min-h-[48px] border-b border-l border-gray-200 p-0.5 dark:border-gray-700"
                  >
                    {hourEvents.map((event) => {
                      const colors = EVENT_TYPE_COLORS[event.type];
                      return (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className={`w-full truncate rounded px-1 py-0.5 text-left text-xs ${colors.bg} ${colors.text}`}
                        >
                          {event.title}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {viewMode === 'month' ? monthLabel : `Week of ${weekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })}`}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={viewMode === 'month' ? goToPrevMonth : goToPrevWeek}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              aria-label="Previous"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Today
            </button>
            <button
              onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              aria-label="Next"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="mr-4 hidden items-center gap-3 lg:flex">
            {(Object.keys(EVENT_TYPE_COLORS) as Array<keyof typeof EVENT_TYPE_COLORS>).map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${EVENT_TYPE_COLORS[type].dot}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {EVENT_TYPE_LABELS[type]}
                </span>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setViewMode('month')}
              className={`rounded-l-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`rounded-r-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Body */}
      {viewMode === 'month' ? (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400"
              >
                {day}
              </div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7">
            {monthDays.map((date, index) => renderDayCell(date, index))}
          </div>
        </div>
      ) : (
        renderWeekView()
      )}
    </div>
  );
}
