'use client';

import React from 'react';

interface WidgetErrorCardProps {
  widgetId: string;
  error: string;
  onAskToFix?: () => void;
  onRollBack?: () => void;
}

export function WidgetErrorCard({ widgetId, error, onAskToFix, onRollBack }: WidgetErrorCardProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-200">Widget error</p>
        <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{error}</p>
      </div>
      <div className="flex gap-2">
        {onAskToFix && (
          <button
            onClick={onAskToFix}
            className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/30"
          >
            Ask AI to fix
          </button>
        )}
        {onRollBack && (
          <button
            onClick={onRollBack}
            className="rounded-lg bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700"
          >
            Roll back
          </button>
        )}
      </div>
    </div>
  );
}
