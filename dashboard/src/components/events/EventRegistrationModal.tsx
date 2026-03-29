'use client';

import { useState, useEffect } from 'react';

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

interface Attendee {
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  status: string;
}

interface EventRegistrationModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EventRegistrationModal({
  event,
  isOpen,
  onClose,
  onSuccess,
}: EventRegistrationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAttendees();
      checkRegistrationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event.id]);

  const fetchAttendees = async () => {
    setLoadingAttendees(true);
    try {
      const response = await fetch(`/api/events/${event.id}/attendees`);
      if (!response.ok) throw new Error('Failed to fetch attendees');
      const data = await response.json();
      setAttendees(data.attendees || []);
    } catch (_err) {
      console.error('Failed to load attendees:', _err);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const checkRegistrationStatus = async () => {
    try {
      const response = await fetch(`/api/events/${event.id}/registration-status`);
      if (response.ok) {
        const data = await response.json();
        setIsRegistered(data.isRegistered);
      }
    } catch (_err) {
      console.error('Failed to check registration status:', _err);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/events/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to register');
      }

      setSuccess('Successfully registered! You earned 20 points!');
      setIsRegistered(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register for event');
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/events/${event.id}/register`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unregister');
      }

      setSuccess('Successfully unregistered');
      setIsRegistered(false);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unregister from event');
    } finally {
      setLoading(false);
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isFull = event.maxAttendees && event._count.attendees >= event.maxAttendees;
  const canRegister = !isFull && !isRegistered;
  const hostInitials = event.host.name
    ? event.host.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-secondary rounded-xl border border-border-subtle max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary border-b border-border-subtle p-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-text-primary mb-1">{event.title}</h2>
            <p className="text-text-secondary text-sm">
              {formatEventDate(event.startTime)} at {formatEventTime(event.startTime)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-accent-green font-medium">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-accent-red font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">About this event</h3>
              <p className="text-text-secondary whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date & Time */}
            <div className="bg-bg-tertiary rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Date & Time</p>
                  <p className="text-text-primary font-medium">{formatEventDate(event.startTime)}</p>
                  <p className="text-text-secondary text-sm">
                    {formatEventTime(event.startTime)}
                    {event.endTime && ` - ${formatEventTime(event.endTime)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Host */}
            <div className="bg-bg-tertiary rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan font-semibold text-sm">
                  {event.host.avatar || hostInitials}
                </div>
                <div>
                  <p className="text-text-muted text-xs">Hosted by</p>
                  <p className="text-text-primary font-medium">{event.host.name || 'Unknown'}</p>
                </div>
              </div>
            </div>

            {/* Attendees */}
            {event.maxAttendees && (
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Attendees</p>
                    <p className="text-text-primary font-medium">
                      {event._count.attendees} / {event.maxAttendees}
                    </p>
                    <p className="text-text-secondary text-sm">
                      {isFull ? 'Event is full' : `${event.maxAttendees - event._count.attendees} spots left`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Meeting Link */}
            {event.meetingUrl && isRegistered && (
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-muted text-xs">Meeting URL</p>
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-cyan hover:underline text-sm truncate block"
                    >
                      Join Meeting
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attendees List */}
          {attendees.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Attendees ({attendees.length})
              </h3>
              <div className="bg-bg-tertiary rounded-lg p-4 max-h-48 overflow-y-auto">
                {loadingAttendees ? (
                  <div className="text-center py-4">
                    <div className="inline-block w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attendees.map((attendee, index) => {
                      const initials = attendee.user.name
                        ? attendee.user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : 'U';

                      return (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan font-semibold text-xs">
                            {attendee.user.avatar || initials}
                          </div>
                          <p className="text-text-primary text-sm">{attendee.user.name || 'Unknown User'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-bg-secondary border-t border-border-subtle p-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-lg bg-bg-tertiary text-text-primary font-medium hover:bg-bg-tertiary/70 transition-colors"
            >
              Close
            </button>
            {isRegistered ? (
              <button
                onClick={handleUnregister}
                disabled={loading}
                className="flex-1 px-6 py-3 rounded-lg bg-accent-red text-white font-medium hover:bg-accent-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Unregistering...' : 'Unregister'}
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={loading || !canRegister}
                className="flex-1 px-6 py-3 rounded-lg bg-accent-cyan text-white font-medium hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : isFull ? 'Event Full' : 'Register (+20 points)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
