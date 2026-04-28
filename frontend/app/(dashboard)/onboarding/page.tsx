'use client';

/**
 * Ghostlog onboarding flow — 3 screens, post-install.
 *
 * 1. "Here's what we watch" — allowlisted apps with icons.
 * 2. "Here's what we never watch" — explicit deny list.
 * 3. "Import your contacts" — drag-and-drop CSV upload (or skip).
 *
 * After step 3, redirects to /dashboard with a banner confirming the daemon
 * needs `ambient auth login` to start auto-logging.
 *
 * See `/Users/michaelkraft/tasks/ghostlog-integration-plan.md` §3 Phase 1
 * week 3 (onboarding flow).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Upload,
} from 'lucide-react';
import { importContactsCsv, type CsvImportResponse } from '@/lib/api/contacts';

type StepIndex = 0 | 1 | 2;

interface AppRow {
  name: string;
  detail: string;
}

const WATCHED_APPS: AppRow[] = [
  { name: 'Gmail', detail: 'Inbound + outbound headers, in Chrome/Safari' },
  { name: 'Outlook', detail: 'Email activity for known contacts' },
  { name: 'Slack', detail: 'DMs with people in your CRM' },
  { name: 'LinkedIn', detail: 'Profile + DM touchpoints' },
  { name: 'Calendly', detail: 'Bookings with known invitees' },
  { name: 'Zoom', detail: 'Participant lists (not recordings)' },
];

const NEVER_WATCHED: AppRow[] = [
  { name: '1Password / Bitwarden', detail: 'Password managers, always denied' },
  { name: 'Banking + crypto apps', detail: 'Detected via window-title regex' },
  { name: 'Incognito / private windows', detail: 'Always skipped' },
  { name: 'Personal Slack DMs', detail: 'If the peer isn’t in your CRM' },
  { name: 'Screen-share toolbars', detail: 'Heuristic-detected, skipped' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);

  // CSV import state (only used on step 2).
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<CsvImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const goNext = () => {
    if (step < 2) setStep((s) => (s + 1) as StepIndex);
  };
  const goBack = () => {
    if (step > 0) setStep((s) => (s - 1) as StepIndex);
  };

  const finish = () => {
    // Use replace so back-button doesn't return to onboarding.
    router.replace('/workspace?first_run=1');
  };

  const handleFile = useCallback((f: File | null) => {
    setError(null);
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File exceeds 5MB. Try a smaller export.');
      setFile(null);
      return;
    }
    setFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const res = await importContactsCsv(file);
      setResult(res);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Upload failed. Please retry.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  }, [file]);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 w-12 rounded-full transition-colors ${
              i === step
                ? 'bg-primary-500'
                : i < step
                  ? 'bg-primary-500/60'
                  : 'bg-slate-300 dark:bg-zinc-700'
            }`}
            aria-current={i === step ? 'step' : undefined}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800/50 dark:bg-zinc-900 sm:p-8">
        {step === 0 && <ScreenWatched />}
        {step === 1 && <ScreenNeverWatched />}
        {step === 2 && (
          <ScreenImportCsv
            file={file}
            onFile={handleFile}
            onUpload={handleUpload}
            isUploading={isUploading}
            result={result}
            error={error}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        )}

        {/* Footer / nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={finish}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                I’ll add them later
              </button>
              <button
                type="button"
                onClick={result ? finish : handleUpload}
                disabled={!file && !result}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {result ? 'Finish' : isUploading ? 'Uploading…' : 'Upload & finish'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function ScreenWatched() {
  return (
    <>
      <div className="flex items-center gap-2 text-primary-500">
        <Eye className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Step 1 of 3</span>
      </div>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        Here’s what we watch
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        Ghostlog only watches these apps. You can change this anytime in Settings.
      </p>

      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-zinc-800 dark:border-zinc-800">
        {WATCHED_APPS.map((app) => (
          <li key={app.name} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                {app.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                {app.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ScreenNeverWatched() {
  return (
    <>
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <EyeOff className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Step 2 of 3</span>
      </div>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        Here’s what we never watch
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        Your screen never leaves your machine. We capture context, redact identifiers,
        and only send observations about people already in your CRM.
      </p>

      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-zinc-800 dark:border-zinc-800">
        {NEVER_WATCHED.map((app) => (
          <li key={app.name} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <EyeOff className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                {app.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                {app.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

interface ScreenImportCsvProps {
  file: File | null;
  onFile: (f: File | null) => void;
  onUpload: () => void;
  isUploading: boolean;
  result: CsvImportResponse | null;
  error: string | null;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}

function ScreenImportCsv({
  file,
  onFile,
  isUploading,
  result,
  error,
  isDragging,
  setIsDragging,
}: ScreenImportCsvProps) {
  return (
    <>
      <div className="flex items-center gap-2 text-primary-500">
        <Upload className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Step 3 of 3</span>
      </div>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        Import your contacts
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        Drag a CSV from HubSpot, Notion, or your spreadsheet. Required column:{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
          email
        </code>
        . Optional: first_name, last_name, company, phone, tags.
      </p>

      {/* Drop zone */}
      <label
        htmlFor="onboarding-csv"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
            : 'border-slate-300 hover:border-slate-400 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`}
      >
        <FileText className="h-8 w-8 text-slate-400" />
        <div className="text-sm font-medium text-slate-700 dark:text-zinc-200">
          {file ? file.name : 'Drop a CSV here, or click to browse'}
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400">
          {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Max 5 MB'}
        </div>
        <input
          id="onboarding-csv"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {isUploading && (
        <div className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
          Uploading…
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <div className="font-semibold">Imported {result.imported} contacts.</div>
          <ul className="mt-1 list-inside list-disc text-xs opacity-80">
            <li>{result.skipped_duplicate} skipped (already in CRM)</li>
            <li>{result.skipped_invalid} skipped (invalid email)</li>
          </ul>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium">
                {result.errors.length} warnings
              </summary>
              <ul className="mt-1 list-inside list-disc text-xs">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
