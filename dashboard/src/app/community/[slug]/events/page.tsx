'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CommunityLayout from '@/components/community/CommunityLayout';
import EventsCalendar from '@/components/events/EventsCalendar';
import EventCard from '@/components/events/EventCard';
import EventRegistrationModal from '@/components/events/EventRegistrationModal';

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

interface Community {
  id: string;
  name: string;
  description: string;
  slug: string;
  _count: {
    members: number;
    posts: number;
    courses: number;
    events: number;
  };
}

export default function EventsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [community, setCommunity] = useState<Community | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    fetchCommunity();
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, filter]);

  const fetchCommunity = async () => {
    try {
      const response = await fetch(`/api/community/${slug}`);
      if (!response.ok) throw new Error('Failed to fetch community');
      const data = await response.json();
      setCommunity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community');
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const communityResponse = await fetch(`/api/community/${slug}`);
      if (!communityResponse.ok) throw new Error('Failed to fetch community');
      const communityData = await communityResponse.json();

      const response = await fetch(
        `/api/communities/${communityData.id}/events?status=${filter}`
      );
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowRegistrationModal(true);
  };

  const handleRegistrationSuccess = () => {
    setShowRegistrationModal(false);
    fetchEvents();
  };

  if (!community && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Community not found
          </h1>
          <p className="text-text-secondary">
            The community you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CommunityLayout community={community}>
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-subtle p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary mb-2">
                Community Events
              </h1>
              <p className="text-text-secondary">
                Join webinars, Q&As, and workshops
              </p>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('calendar')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'calendar'
                    ? 'bg-accent-cyan text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'list'
                    ? 'bg-accent-cyan text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }`}
              >
                List
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {(['all', 'upcoming', 'past'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === type
                    ? 'bg-accent-cyan text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">
        {/* Error State */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 mb-6">
            <p className="text-accent-red">{error}</p>
            <button onClick={fetchEvents} className="text-accent-cyan underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && !loading && (
          <EventsCalendar events={events} onEventClick={handleEventClick} />
        )}

        {/* List View */}
        {view === 'list' && (
          <>
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-bg-secondary rounded-xl border border-border-subtle p-6 animate-pulse"
                  >
                    <div className="h-6 bg-bg-tertiary rounded w-2/3 mb-3"></div>
                    <div className="h-4 bg-bg-tertiary rounded w-full mb-2"></div>
                    <div className="h-4 bg-bg-tertiary rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            )}

            {!loading && events.length > 0 && (
              <div className="space-y-4">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => handleEventClick(event)}
                  />
                ))}
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
                <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No events scheduled
                </h3>
                <p className="text-text-secondary">Check back later for upcoming events!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Event Registration Modal */}
      {selectedEvent && (
        <EventRegistrationModal
          event={selectedEvent}
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          onSuccess={handleRegistrationSuccess}
        />
      )}
    </CommunityLayout>
  );
}
