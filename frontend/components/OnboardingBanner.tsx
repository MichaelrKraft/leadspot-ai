'use client';

/**
 * Onboarding-complete banner.
 *
 * Renders only when the URL contains `?onboarded=1` (the onboarding flow
 * redirects here). User can dismiss; dismissal sets a sessionStorage flag
 * so an accidental refresh on the same tab keeps it hidden.
 *
 * Self-contained on purpose — keeps the dashboard page change minimal
 * (one import + one render).
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'ghostlog-onboarding-banner-dismissed';

export default function OnboardingBanner() {
  const params = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params?.get('onboarded') !== '1') return;
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem(STORAGE_KEY) === '1') return;
      } catch {
        /* sessionStorage may be disabled */
      }
    }
    setVisible(true);
  }, [params]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="mx-auto mb-6 flex w-full max-w-3xl items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-800 dark:bg-primary-900/20">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" />
      <div className="min-w-0 flex-1 text-sm text-slate-700 dark:text-zinc-200">
        <div className="font-semibold text-slate-900 dark:text-white">
          Your daemon is ready.
        </div>
        <div className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
          Run{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
            ambient auth login
          </code>{' '}
          on your Mac to start auto-logging.
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
