'use client';

/**
 * Privacy & Ghostlog settings page (plan §11, Phase 2 part A).
 *
 * Sections:
 *   1. Connected Macs        — list + revoke daemons
 *   2. Pause                 — 1h / today / forever / resume
 *   3. Apps we watch         — read-only allowlist + denylist (v1)
 *   4. EU strict mode toggle — plan §11.3
 *   5. Right to be forgotten — user-facing forget; admin-only purge by hash
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  Cpu,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import SettingsNav from '@/components/settings/SettingsNav';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  DaemonDevice,
  forgetContact,
  getEuStrictMode,
  listDevices,
  PauseDuration,
  revokeDevice,
  setEuStrictMode,
  setPause,
  adminPurgeByHash,
} from '@/lib/api/privacy';

// =============================================================================
// Static data — mirrored from coder1-ambient/src/leadspot/allowlist.ts.
// Kept duplicated rather than imported because the daemon source isn't part
// of this Next.js project's path resolution. Update both files together.
// =============================================================================

const APPS_ALLOWLIST: ReadonlyArray<string> = [
  'Apple Mail',
  'Microsoft Outlook',
  'Spark',
  'Superhuman',
  'Google Chrome (Gmail/LinkedIn/Calendly only)',
  'Safari (Gmail/LinkedIn/Calendly only)',
  'Firefox (Gmail/LinkedIn/Calendly only)',
  'Arc',
  'Brave',
  'Edge',
  'Slack',
  'Linear',
  'Discord',
  'Cron',
  'Fantastical',
  'Notion Calendar',
  'Apple Calendar',
  'Zoom',
  'Notion',
];

const APPS_DENYLIST: ReadonlyArray<string> = [
  '1Password',
  'Bitwarden',
  'LastPass',
  'Dashlane',
  'Keychain Access',
  'Mint',
  'Personal Capital',
  'Coinbase',
  'Robinhood',
  'Fidelity',
  'Schwab',
  'Vanguard',
  'E*Trade',
  'Ledger Live',
  'MetaMask',
  'Venmo',
  'Cash App',
];

// Year-3000 sentinel from backend daemon_pause router.
const FOREVER_THRESHOLD_YEAR = 2900;

// =============================================================================
// Page
// =============================================================================

export default function PrivacySettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Privacy</h1>
        <p className="text-sm text-gray-400">
          Manage Ghostlog daemons, pause capture, and request data deletion.
        </p>
      </header>

      <SettingsNav />

      <div className="space-y-6">
        <ConnectedMacsSection />
        <PauseSection />
        <EuStrictModeSection />
        <AppsWeWatchSection />
        <RightToBeForgottenSection isAdmin={isAdmin} />
      </div>
    </div>
  );
}

// =============================================================================
// Section: Connected Macs
// =============================================================================

function ConnectedMacsSection() {
  const [devices, setDevices] = useState<DaemonDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDevices();
      setDevices(list);
    } catch {
      setError('Could not load devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleRevoke = async (daemonId: string, label: string) => {
    if (
      !confirm(
        `Revoke ${label || 'this Mac'}? The Ambient daemon will stop syncing until you re-authenticate.`
      )
    ) {
      return;
    }
    setRevokingId(daemonId);
    try {
      await revokeDevice(daemonId);
      await refresh();
    } catch {
      setError('Revoke failed. Please try again.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <SectionShell
      title="Connected Macs"
      description="Devices authorized to sync Ghostlog activity to your account."
      iconColor="indigo"
      icon={<Cpu className="w-5 h-5" />}
    >
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
      ) : devices.length === 0 ? (
        <p className="text-sm text-gray-500">
          No Macs connected. Run <code className="px-1 py-0.5 rounded bg-black/30 text-gray-300">ambient auth login</code>{' '}
          on a Mac to add one.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/20">
          {devices.map((d) => {
            const lastSeen = d.last_seen_at
              ? new Date(d.last_seen_at).toLocaleString()
              : 'never';
            return (
              <li
                key={d.daemon_id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {d.device_label || 'Unnamed Mac'}
                  </p>
                  <p className="text-xs text-gray-500">Last seen: {lastSeen}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(d.daemon_id, d.device_label)}
                  disabled={revokingId === d.daemon_id}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                >
                  {revokingId === d.daemon_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Revoke
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

// =============================================================================
// Section: Pause
// =============================================================================

function PauseSection() {
  const [pending, setPending] = useState<PauseDuration | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);

  const isPaused = useMemo(() => {
    if (!pausedUntil) return false;
    return new Date(pausedUntil) > new Date();
  }, [pausedUntil]);

  const isForever = useMemo(() => {
    if (!pausedUntil) return false;
    const dt = new Date(pausedUntil);
    return dt.getUTCFullYear() >= FOREVER_THRESHOLD_YEAR;
  }, [pausedUntil]);

  const fire = async (duration: PauseDuration) => {
    setPending(duration);
    setMessage(null);
    try {
      const res = await setPause(duration);
      setPausedUntil(res.paused_until);
      const label =
        duration === 'resume'
          ? 'Resumed all Macs.'
          : duration === '1h'
            ? 'Paused for 1 hour.'
            : duration === 'today'
              ? 'Paused for today.'
              : 'Paused indefinitely.';
      setMessage({ type: 'success', text: `${label} (${res.affected} ${res.affected === 1 ? 'Mac' : 'Macs'})` });
    } catch {
      setMessage({ type: 'error', text: 'Could not update pause state.' });
    } finally {
      setPending(null);
    }
  };

  return (
    <SectionShell
      title="Pause capture"
      description="Stops the Ambient daemon from running Haiku and writing signals on every connected Mac."
      iconColor="amber"
      icon={<Pause className="w-5 h-5" />}
    >
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {isPaused && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Capture is paused
          {isForever
            ? ' indefinitely.'
            : pausedUntil
              ? ` until ${new Date(pausedUntil).toLocaleString()}.`
              : '.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PauseButton label="Pause for 1 hour" duration="1h" pending={pending} onClick={fire} />
        <PauseButton label="Pause for today" duration="today" pending={pending} onClick={fire} />
        <PauseButton label="Pause indefinitely" duration="forever" pending={pending} onClick={fire} />
        <button
          type="button"
          onClick={() => fire('resume')}
          disabled={pending !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {pending === 'resume' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Resume capture
        </button>
      </div>
    </SectionShell>
  );
}

function PauseButton({
  label,
  duration,
  pending,
  onClick,
}: {
  label: string;
  duration: PauseDuration;
  pending: PauseDuration | null;
  onClick: (d: PauseDuration) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(duration)}
      disabled={pending !== null}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-white/10 disabled:opacity-40"
    >
      {pending === duration ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Pause className="w-4 h-4" />
      )}
      {label}
    </button>
  );
}

// =============================================================================
// Section: Apps we watch (read-only)
// =============================================================================

function AppsWeWatchSection() {
  return (
    <SectionShell
      title="Apps we watch"
      description="The Ambient daemon only extracts signals from these apps. Editing this list ships in a future update."
      iconColor="sky"
      icon={<ShieldCheck className="w-5 h-5" />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            <CheckCircle2 className="inline-block w-3.5 h-3.5 mr-1 align-text-bottom" />
            Allowlist
          </h3>
          <ul className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
            {APPS_ALLOWLIST.map((app) => (
              <li key={app} className="break-words">
                {app}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
            <CircleSlash className="inline-block w-3.5 h-3.5 mr-1 align-text-bottom" />
            Denylist
          </h3>
          <ul className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
            {APPS_DENYLIST.map((app) => (
              <li key={app} className="break-words">
                {app}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Window-title patterns also block extraction (incognito tabs, banking
        URLs, screen-share apps) — see the privacy policy for details.
      </p>
    </SectionShell>
  );
}

// =============================================================================
// Section: EU strict mode
// =============================================================================

function EuStrictModeSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEuStrictMode()
      .then((s) => {
        if (!cancelled) setEnabled(s.eu_strict_mode);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setSaving(true);
    setError(null);
    try {
      const next = !enabled;
      const res = await setEuStrictMode(next);
      setEnabled(res.eu_strict_mode);
    } catch {
      setError('Could not update setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="EU strict mode"
      description="Stricter retention and reduced audit metadata for users with EU contacts."
      iconColor="violet"
      icon={<ShieldCheck className="w-5 h-5" />}
    >
      {error && <ErrorBanner message={error} />}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled === true}
          onChange={toggle}
          disabled={saving || enabled === null}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 text-violet-500 focus:ring-violet-500"
        />
        <span className="text-sm text-gray-200">
          I have customers or contacts in the EU
          <span className="block text-xs text-gray-500 mt-0.5">
            Enables stricter data retention: 30-day TTL on unmatched signals,
            no OCR-snippet hashes stored cloud-side for unmatched signals.
          </span>
        </span>
      </label>
    </SectionShell>
  );
}

// =============================================================================
// Section: Right to be forgotten
// =============================================================================

function RightToBeForgottenSection({ isAdmin }: { isAdmin: boolean }) {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ purged: number; tombstoneId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin-only "purge by hash" form
  const [adminHash, setAdminHash] = useState('');
  const [adminReason, setAdminReason] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminResult, setAdminResult] = useState<{ purged: number; tombstoneId: string } | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await forgetContact(email.trim(), reason.trim() || undefined);
      setResult({ purged: res.purged_count, tombstoneId: res.tombstone_id });
      setEmail('');
      setReason('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdmin = async () => {
    if (adminHash.trim().length !== 64) {
      setAdminError('Email hash must be 64 hex chars.');
      return;
    }
    setAdminSubmitting(true);
    setAdminError(null);
    setAdminResult(null);
    try {
      const res = await adminPurgeByHash(
        adminHash.trim(),
        adminReason.trim() || undefined
      );
      setAdminResult({ purged: res.purged_count, tombstoneId: res.tombstone_id });
      setAdminHash('');
      setAdminReason('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setAdminError(msg);
    } finally {
      setAdminSubmitting(false);
    }
  };

  return (
    <SectionShell
      title="Right to be forgotten"
      description="Permanently delete all Ghostlog data we have for a contact. The deletion propagates to every connected Mac on next sync."
      iconColor="rose"
      icon={<Trash2 className="w-5 h-5" />}
    >
      {/* Self-service form (any user) */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          Contact email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="someone@example.com"
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (max 120 chars)"
          maxLength={120}
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !email.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Forget this contact (my org)
        </button>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Purged {result.purged} signal{result.purged === 1 ? '' : 's'}.
            <span className="block text-xs text-emerald-400/70 mt-0.5">
              Tombstone: <code className="font-mono">{result.tombstoneId}</code>
            </span>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-6 border-t border-white/5 pt-6">
          <h3 className="mb-2 text-sm font-semibold text-amber-400">
            Admin: purge across orgs by email hash
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            For support tickets where the requester is not in your org. Pre-compute
            the sha256 of the normalized email (lowercased, +alias stripped).
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={adminHash}
              onChange={(e) => setAdminHash(e.target.value)}
              placeholder="64-character sha256 hash"
              maxLength={64}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            <input
              type="text"
              value={adminReason}
              onChange={(e) => setAdminReason(e.target.value)}
              placeholder="Reason / ticket ID (max 120 chars)"
              maxLength={120}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            <button
              type="button"
              onClick={submitAdmin}
              disabled={adminSubmitting || adminHash.length !== 64}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-40"
            >
              {adminSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Admin purge
            </button>
            {adminError && <ErrorBanner message={adminError} />}
            {adminResult && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                Purged {adminResult.purged} signal{adminResult.purged === 1 ? '' : 's'}.
                <span className="block text-xs text-emerald-400/70 mt-0.5">
                  Tombstone: <code className="font-mono">{adminResult.tombstoneId}</code>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function SectionShell({
  title,
  description,
  iconColor,
  icon,
  children,
}: {
  title: string;
  description: string;
  iconColor: 'indigo' | 'amber' | 'sky' | 'violet' | 'rose';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  };
  return (
    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className={`p-2.5 rounded-xl border ${colorMap[iconColor]}`}>{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <p className="text-xs sm:text-sm text-gray-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      <AlertCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}
