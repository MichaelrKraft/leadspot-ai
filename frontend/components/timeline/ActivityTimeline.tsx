'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Inbox } from 'lucide-react';
import {
  listContactSignals,
  deleteSignal,
  type Signal,
} from '@/lib/api/signals';
import { formatRelativeTime } from '@/lib/format-relative-time';
import SignalDrawer from './SignalDrawer';

interface ActivityTimelineProps {
  contactId: string;
}

type SourceFilter = 'all' | 'Gmail' | 'Slack' | 'LinkedIn' | 'Calendly' | 'Zoom';

const SOURCE_FILTERS: SourceFilter[] = ['all', 'Gmail', 'Slack', 'LinkedIn', 'Calendly', 'Zoom'];

const VERB_BY_EXTRACTOR: Record<string, string> = {
  gmail_header: 'Sent email',
  slack_dm_peer: 'Slack DM',
  calendly_invitee: 'Booked meeting',
  zoom_participant: 'Joined call',
  explicit_email: 'Email',
  linkedin_url: 'LinkedIn touchpoint',
};

function iconFor(signal: Signal): string {
  if (signal.confidence >= 90) {
    if (signal.extractor === 'calendly_invitee') return '📅';
    if (signal.extractor === 'zoom_participant') return '📞';
    if (signal.extractor === 'slack_dm_peer') return '💬';
    if (signal.extractor === 'linkedin_url') return '🔗';
    return '🎯';
  }
  switch (signal.source_app) {
    case 'Slack':
      return '💬';
    case 'Calendly':
      return '📅';
    case 'Zoom':
      return '📞';
    case 'LinkedIn':
      return '🔗';
    case 'Gmail':
    default:
      return '📧';
  }
}

function truncateAt(s: string, max = 100): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

export default function ActivityTimeline({ contactId }: ActivityTimelineProps) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [openSignal, setOpenSignal] = useState<Signal | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial load
  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listContactSignals(contactId, { limit: 50 });
      setSignals(data.signals);
      setNextBefore(data.next_before);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Pagination via IntersectionObserver
  const loadMore = useCallback(async () => {
    if (!nextBefore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await listContactSignals(contactId, {
        limit: 50,
        before: nextBefore,
      });
      setSignals((prev) => [...prev, ...data.signals]);
      setNextBefore(data.next_before);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoadingMore(false);
    }
  }, [contactId, nextBefore, isLoadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // SSE — refetch first page on push
  useEffect(() => {
    // Same-origin: Next.js rewrites /api → backend, cookies travel automatically.
    const url = `/api/contacts/${contactId}/signals/stream`;
    let es: EventSource;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch {
      return;
    }
    eventSourceRef.current = es;

    es.onmessage = async (e) => {
      try {
        const payload = JSON.parse(e.data) as { contact_id?: string };
        if (payload.contact_id && payload.contact_id !== contactId) return;
        // Refetch the most recent page; merge by id to avoid duplicates.
        const data = await listContactSignals(contactId, { limit: 50 });
        setSignals((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          const fresh = data.signals.filter((s) => !seen.has(s.id));
          if (fresh.length === 0) return prev;
          return [...fresh, ...prev];
        });
      } catch {
        // Ignore malformed SSE payloads; the row will appear on next poll/refresh.
      }
    };

    es.onerror = () => {
      // Browser auto-reconnects EventSource; just log and keep going.
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [contactId]);

  // Filter (client-side only in v1)
  const filtered = useMemo(() => {
    if (filter === 'all') return signals;
    return signals.filter((s) => s.source_app === filter);
  }, [signals, filter]);

  // Optimistic drop with rollback on failure
  const handleDrop = useCallback(
    async (signalId: string) => {
      const prev = signals;
      setSignals((curr) => curr.filter((s) => s.id !== signalId));
      try {
        await deleteSignal(signalId);
      } catch (err) {
        setSignals(prev);
        setError(err instanceof Error ? err.message : 'Failed to drop signal');
      }
    },
    [signals]
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-zinc-800/50 dark:bg-zinc-900">
      {/* Header + filter bar */}
      <div className="border-b border-gray-200 px-5 py-4 dark:border-zinc-800/50">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Activity
          </h2>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            Auto-logged from Ambient
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SOURCE_FILTERS.map((s) => {
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-indigo-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {s === 'all' ? 'All sources' : s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div>
        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
            Loading activity…
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="px-5 py-16 text-center">
            <Inbox className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-200">
              No activity yet.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Once Ambient is running on your Mac, your touchpoints with this contact
              will appear here automatically.
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-zinc-800/50">
            {filtered.map((signal) => {
              const verb = VERB_BY_EXTRACTOR[signal.extractor] ?? 'Activity';
              const summary = truncateAt(signal.summary, 100);
              return (
                <li
                  key={signal.id}
                  className="group relative cursor-pointer px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                  onClick={() => setOpenSignal(signal)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-lg leading-none" aria-hidden>
                      {iconFor(signal)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {verb}
                        </span>
                        <span className="text-slate-400 dark:text-zinc-500">·</span>
                        <span className="italic text-slate-700 dark:text-zinc-200">
                          &ldquo;{summary}&rdquo;
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-zinc-400">
                        {signal.source_app && (
                          <>
                            <span>{signal.source_app}</span>
                            <span className="text-slate-300 dark:text-zinc-600">·</span>
                          </>
                        )}
                        <span>{formatRelativeTime(signal.observed_at)}</span>
                        <span className="hidden text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600 sm:inline">
                          ·
                        </span>
                        <span className="hidden text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500 sm:inline">
                          Auto-logged from Ambient
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          typeof window !== 'undefined' &&
                          window.confirm(
                            'Drop this signal? This permanently removes it from the timeline.'
                          )
                        ) {
                          handleDrop(signal.id);
                        }
                      }}
                      aria-label="Drop this signal"
                      className="flex shrink-0 items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-slate-400 opacity-0 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:border-red-900/50 dark:hover:bg-red-900/20 dark:hover:text-red-300 sm:opacity-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Drop</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination sentinel */}
        {nextBefore && (
          <div ref={sentinelRef} className="px-5 py-4 text-center">
            {isLoadingMore && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">Loading…</span>
            )}
          </div>
        )}
      </div>

      {/* Drawer */}
      {openSignal && (
        <SignalDrawer
          signal={openSignal}
          onClose={() => setOpenSignal(null)}
          onDrop={handleDrop}
        />
      )}
    </div>
  );
}
