'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarEvent,
  EventType,
  EventStatus,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
} from '@/types/calendar';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
}

const DURATION_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [type, setType] = useState<EventType>('meeting');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<EventStatus>('scheduled');

  const isEditing = Boolean(event);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDate(event.date);
      setStartTime(event.startTime);
      setEndTime(event.endTime);
      setType(event.type);
      setContactName(event.contactName || '');
      setContactEmail(event.contactEmail || '');
      setNotes(event.notes || '');
      setStatus(event.status);
    } else {
      setTitle('');
      setDate(defaultDate || '');
      setStartTime('09:00');
      setEndTime('09:30');
      setType('meeting');
      setContactName('');
      setContactEmail('');
      setNotes('');
      setStatus('scheduled');
    }
  }, [event, defaultDate, isOpen]);

  const handleDurationPreset = (minutes: number) => {
    setEndTime(addMinutesToTime(startTime, minutes));
  };

  const handleSave = () => {
    if (!title.trim() || !date) return;

    const newEvent: CalendarEvent = {
      id: event?.id || generateId(),
      title: title.trim(),
      date,
      startTime,
      endTime,
      type,
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    };

    onSave(newEvent);
    onClose();
  };

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800/50 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-zinc-800/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => {
                const colors = EVENT_TYPE_COLORS[t];
                const isActive = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? `${colors.bg} ${colors.text} border-current`
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                    {EVENT_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          {/* Duration Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Quick:</span>
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                onClick={() => handleDurationPreset(preset.minutes)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-white/10"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Contact Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contact Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Contact Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Status (only when editing) */}
          {isEditing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-zinc-800/50">
          <div>
            {isEditing && onDelete && event && (
              <button
                onClick={() => {
                  onDelete(event.id);
                  onClose();
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !date}
              className="rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary-500/20 transition-colors hover:from-primary-600 hover:to-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEditing ? 'Update' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
