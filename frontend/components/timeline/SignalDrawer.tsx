'use client';

import { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Signal } from '@/lib/api/signals';
import { formatRelativeTime } from '@/lib/format-relative-time';

interface SignalDrawerProps {
  signal: Signal;
  onClose: () => void;
  onDrop: (signalId: string) => void;
}

const EXTRACTOR_LABELS: Record<string, string> = {
  gmail_header: 'Detected from Gmail header',
  slack_dm_peer: 'Detected from Slack DM peer list',
  calendly_invitee: 'Detected from Calendly invite',
  zoom_participant: 'Detected from Zoom participant list',
  explicit_email: 'Detected from inline email address',
  linkedin_url: 'Detected from LinkedIn URL',
};

const VERB_LABELS: Record<string, string> = {
  gmail_header: 'Sent email',
  slack_dm_peer: 'Slack DM',
  calendly_invitee: 'Booked meeting',
  zoom_participant: 'Joined call',
  explicit_email: 'Email',
  linkedin_url: 'LinkedIn touchpoint',
};

function truncateMiddle(s: string | null, head = 4, tail = 4): string {
  if (!s) return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 85) return 'bg-green-500';
  if (confidence >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function SignalDrawer({ signal, onClose, onDrop }: SignalDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const verb = VERB_LABELS[signal.extractor] ?? 'Activity';
  const extractorReason =
    EXTRACTOR_LABELS[signal.extractor] ?? `Detected via ${signal.extractor}`;

  const handleDrop = () => {
    if (typeof window !== 'undefined' && window.confirm('Drop this signal? This permanently removes it from the timeline.')) {
      onDrop(signal.id);
      onClose();
    }
  };

  const fullIso = new Date(signal.observed_at).toISOString();
  const relative = formatRelativeTime(signal.observed_at);

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
      />
      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Signal details"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              {signal.source_app || 'Unknown source'}
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
              {verb}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Time */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Observed
            </div>
            <div className="mt-1 text-sm text-slate-900 dark:text-white">{relative}</div>
            <div className="mt-0.5 font-mono text-xs text-slate-400 dark:text-zinc-500">
              {fullIso}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Summary
            </div>
            <p className="mt-1 text-sm italic text-slate-800 dark:text-zinc-100">
              &ldquo;{signal.summary}&rdquo;
            </p>
          </div>

          {/* Why was this logged? */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
              Why was this logged?
            </div>
            <p className="mt-1 text-sm text-slate-700 dark:text-zinc-200">
              {extractorReason}.
            </p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <dt className="w-28 text-slate-500 dark:text-zinc-500">OCR hash</dt>
                <dd className="font-mono text-slate-700 dark:text-zinc-200">
                  {truncateMiddle(signal.ocr_snippet_hash)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="w-28 text-slate-500 dark:text-zinc-500">Signal ID</dt>
                <dd className="font-mono text-slate-700 dark:text-zinc-200">
                  {truncateMiddle(signal.id, 6, 6)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="w-28 text-slate-500 dark:text-zinc-500">Extractor</dt>
                <dd className="font-mono text-slate-700 dark:text-zinc-200">{signal.extractor}</dd>
              </div>
            </dl>
          </div>

          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Confidence
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {signal.confidence}/100
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              <div
                className={`h-full ${confidenceColor(signal.confidence)} transition-all`}
                style={{ width: `${Math.max(0, Math.min(100, signal.confidence))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer — drop button */}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-zinc-800">
          <button
            onClick={handleDrop}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:border-red-300 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <Trash2 className="h-4 w-4" />
            Drop this signal
          </button>
        </div>
      </aside>
    </>
  );
}
