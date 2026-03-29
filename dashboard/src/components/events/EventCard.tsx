'use client';

import React from 'react';

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

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

export default function EventCard({ event, onClick }: EventCardProps) {
  const startDate = new Date(event.startTime);
  const endDate = event.endTime ? new Date(event.endTime) : null;
  const spotsRemaining = event.maxAttendees
    ? event.maxAttendees - event._count.attendees
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-cyan transition-colors text-left group"
    >
      {/* Date Badge */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 bg-bg-tertiary rounded-lg p-3 text-center min-w-[4rem]">
          <div className="text-2xl font-bold text-text-primary">
            {startDate.getDate()}
          </div>
          <div className="text-xs text-text-secondary uppercase">
            {startDate.toLocaleDateString('en-US', { month: 'short' })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-accent-cyan transition-colors">
            {event.title}
          </h3>

          {/* Description */}
          {event.description && (
            <p className="text-text-secondary text-sm mb-3 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Time and Host */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            {/* Time */}
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                {startDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {endDate && (
                  <>
                    {' - '}
                    {endDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </span>
            </div>

            {/* Host */}
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>{event.host.name || 'Unknown Host'}</span>
            </div>

            {/* Attendees */}
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>{event._count.attendees} attending</span>
            </div>
          </div>

          {/* Spots Remaining */}
          {spotsRemaining !== null && spotsRemaining > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg text-xs text-accent-cyan">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {spotsRemaining} spots remaining
            </div>
          )}

          {spotsRemaining === 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-accent-red/10 border border-accent-red/30 rounded-lg text-xs text-accent-red">
              Event Full
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
