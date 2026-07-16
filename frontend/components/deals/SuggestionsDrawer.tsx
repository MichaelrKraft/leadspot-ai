'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, Mail, FileText, Check, ArrowRight } from 'lucide-react';
import {
  listSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  type DealSuggestion,
} from '@/lib/api/suggestions';

function stageLabel(id: string): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function confidencePill(confidence: number): { classes: string; label: string } {
  if (confidence >= 80) {
    return { classes: 'bg-green-500/20 text-green-500', label: `${confidence}% confident` };
  }
  if (confidence >= 50) {
    return { classes: 'bg-yellow-500/20 text-yellow-600', label: `${confidence}% confident` };
  }
  return { classes: 'bg-red-500/20 text-red-500', label: `${confidence}% confident` };
}

interface SuggestionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void; // parent refreshes board + badge
}

export default function SuggestionsDrawer({ isOpen, onClose, onResolved }: SuggestionsDrawerProps) {
  const [suggestions, setSuggestions] = useState<DealSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    listSuggestions()
      .then(setSuggestions)
      .catch((err) => console.error('[SuggestionsDrawer] failed to load:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  async function resolve(id: string, action: 'accept' | 'reject') {
    setBusyId(id);
    try {
      if (action === 'accept') {
        await acceptSuggestion(id);
      } else {
        await rejectSuggestion(id);
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      onResolved();
    } catch (err) {
      console.error(`[SuggestionsDrawer] failed to ${action}:`, err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI Suggestions</h2>
            {suggestions.length > 0 && (
              <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-xs font-semibold text-primary-500">
                {suggestions.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500" />
            </div>
          )}

          {!isLoading && suggestions.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <Sparkles className="h-8 w-8 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No pending suggestions.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                New emails and documents are analyzed automatically — suggested stage moves show up here.
              </p>
            </div>
          )}

          {suggestions.map((s) => {
            const pill = confidencePill(s.confidence);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-[#0f0f12]"
              >
                {/* Deal + stages */}
                <div className="mb-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {s.deal_title ?? 'Unknown deal'}
                  </p>
                  {s.property_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.property_name}</p>
                  )}
                </div>

                <div className="mb-3 flex items-center gap-2 text-xs font-medium">
                  <span className="rounded bg-gray-200 px-2 py-1 text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                    {stageLabel(s.current_stage)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary-500" />
                  <span className="rounded bg-primary-500/20 px-2 py-1 text-primary-500">
                    {stageLabel(s.suggested_stage)}
                  </span>
                  <span className={`ml-auto rounded-full px-2 py-1 ${pill.classes}`}>{pill.label}</span>
                </div>

                {/* Evidence */}
                {s.evidence && (
                  <p className="mb-2 border-l-2 border-primary-500/50 pl-2 text-xs italic text-gray-600 dark:text-gray-300">
                    &ldquo;{s.evidence}&rdquo;
                  </p>
                )}

                {/* Source */}
                {s.source && (
                  <div className="mb-3 rounded-lg bg-white p-2 text-xs dark:bg-zinc-900">
                    <div className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200">
                      {s.source_type === 'email' ? (
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span className="truncate">{s.source.subject ?? 'Document'}</span>
                    </div>
                    {s.source.from_address && (
                      <p className="mt-0.5 text-gray-400">from: {s.source.from_address}</p>
                    )}
                    {s.source.body_preview && (
                      <p className="mt-1 line-clamp-2 text-gray-500 dark:text-gray-400">
                        {s.source.body_preview}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(s.id, 'accept')}
                    disabled={busyId === s.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept &amp; Move
                  </button>
                  <button
                    onClick={() => resolve(s.id, 'reject')}
                    disabled={busyId === s.id}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
