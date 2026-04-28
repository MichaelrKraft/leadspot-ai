'use client';

/**
 * Public install page.
 *
 * Confirmation after Stripe checkout. Shows:
 * - Success state if `?session_id=...` is present.
 * - "Download for Mac" button (placeholder URL — BLOCKED on Apple Developer
 *   .pkg signing).
 * - 3-step Next guide.
 *
 * No auth required — this is the post-checkout landing.
 *
 * See `/Users/michaelkraft/tasks/ghostlog-integration-plan.md` §3 Phase 1
 * week 3 (Stripe checkout + install URL).
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, Terminal, Clock } from 'lucide-react';

// Placeholder. Replace with the signed .pkg URL once Apple Developer signing
// is provisioned. TODO(blocked-on-apple-dev).
const DOWNLOAD_URL = 'https://app.leadspot.ai/downloads/ambient-latest.pkg';

export default function InstallPage() {
  return (
    <Suspense fallback={<InstallShell />}>
      <InstallContent />
    </Suspense>
  );
}

function InstallContent() {
  const params = useSearchParams();
  const sessionId = params?.get('session_id') ?? null;
  const isCheckoutSuccess = Boolean(sessionId);

  return (
    <InstallShell>
      <main className="mx-auto max-w-xl px-6 py-12">
        {isCheckoutSuccess ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <div className="text-sm font-semibold text-green-900 dark:text-green-200">
                Subscription confirmed
              </div>
              <div className="mt-0.5 text-xs text-green-800/80 dark:text-green-300/80 break-all">
                Session: <code>{sessionId}</code>
              </div>
            </div>
          </div>
        ) : null}

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Install LeadSpot for Mac
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Ghostlog runs as a tiny daemon on your Mac. Download, install, and authorize
          it in two minutes.
        </p>

        <a
          href={DOWNLOAD_URL}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary-700"
        >
          <Download className="h-5 w-5" />
          Download for Mac
        </a>
        <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
          macOS 13+ · Apple Silicon &amp; Intel · ~12 MB
        </div>

        <h2 className="mt-10 text-base font-semibold text-gray-900 dark:text-white">
          Next steps
        </h2>
        <ol className="mt-4 space-y-4">
          <Step
            n={1}
            icon={<Download className="h-4 w-4" />}
            title="Install the daemon"
            body="Open the downloaded .pkg and follow the macOS prompts. Grant Screen Recording permission when asked."
          />
          <Step
            n={2}
            icon={<Terminal className="h-4 w-4" />}
            title="Authorize this Mac"
            body={
              <>
                Run{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                  ambient auth login
                </code>{' '}
                in Terminal. Your browser will open, click “Authorize this Mac.”
              </>
            }
          />
          <Step
            n={3}
            icon={<Clock className="h-4 w-4" />}
            title="Wait ~60 seconds"
            body="Send a test email or open a known contact in Slack. Your first signal will appear in your CRM timeline within a minute."
          />
        </ol>

        <p className="mt-10 text-xs text-slate-500 dark:text-zinc-500">
          Trouble? Email{' '}
          <a
            className="underline"
            href="mailto:support@leadspot.ai"
          >
            support@leadspot.ai
          </a>
          .
        </p>
      </main>
    </InstallShell>
  );
}

function InstallShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0b0b0c] dark:text-zinc-100">
      {children}
    </div>
  );
}

interface StepProps {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

function Step({ n, icon, title, body }: StepProps) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
            Step {n}
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </span>
        </div>
        <div className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          {body}
        </div>
      </div>
    </li>
  );
}
