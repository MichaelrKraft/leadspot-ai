'use client';

/**
 * Per-user cost dashboard (plan §13.4).
 *
 * Visible to admin/superadmin users only. Pulls aggregated Haiku/Sonnet
 * token usage from `/api/admin/cost-dashboard?days=N` and renders a
 * sortable-by-default-sorted table. Outliers (users near or over the
 * daily Haiku cap) are highlighted.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import { useAuthStore } from '@/stores/useAuthStore';
import {
  CostDashboardResponse,
  CostDashboardUserRow,
  getCostDashboard,
} from '@/lib/api/privacy';

// Threshold below which we don't bother highlighting (kept here so it can
// be tuned without redeploy if Mike wants tighter alerting).
const NEAR_CAP_RATIO = 0.8;

export default function CostDashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [days, setDays] = useState(30);
  const [data, setData] = useState<CostDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCostDashboard(days);
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load cost data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void refresh();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, isAdmin]);

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <ShieldAlert className="w-4 h-4" />
          Admin access required.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Cost dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Per-user Haiku and Sonnet token spend over the last {days} days.
            Sorted by Haiku tokens descending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DaysSelect days={days} onChange={setDays} />
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
          <CsvButton data={data} />
        </div>
      </header>

      {error && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Totals data={data} />

      <UsersTable data={data} loading={loading} />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function DaysSelect({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <select
      value={days}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
    >
      <option value={7}>Last 7 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>
  );
}

function Totals({ data }: { data: CostDashboardResponse | null }) {
  if (!data) return null;
  const t = data.totals;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Users" value={t.user_count.toLocaleString()} />
      <Stat label="Haiku tokens" value={t.haiku_tokens_30d.toLocaleString()} />
      <Stat label="Sonnet tokens" value={t.sonnet_tokens_30d.toLocaleString()} />
      <Stat label="Estimated USD" value={`$${t.estimated_cost_30d_usd.toFixed(2)}`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function UsersTable({
  data,
  loading,
}: {
  data: CostDashboardResponse | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-white/5" />;
  }
  if (!data || data.users.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-500">
        No usage data yet.
      </div>
    );
  }

  const cap = data.totals.cap;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <Th align="left">User</Th>
            <Th align="right">Haiku today</Th>
            <Th align="right">Haiku 30d</Th>
            <Th align="right">Sonnet 30d</Th>
            <Th align="right">Cost (USD)</Th>
            <Th align="right">Cap hits</Th>
            <Th align="right">Macs</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-gray-200">
          {data.users.map((u) => (
            <UserRow key={u.user_id} u={u} cap={cap} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ u, cap }: { u: CostDashboardUserRow; cap: number }) {
  const isOverCap = cap > 0 && u.haiku_tokens_today >= cap;
  const isNearCap = cap > 0 && !isOverCap && u.haiku_tokens_today >= cap * NEAR_CAP_RATIO;

  return (
    <tr
      className={
        isOverCap
          ? 'bg-red-500/10'
          : isNearCap
            ? 'bg-amber-500/10'
            : 'hover:bg-white/5'
      }
    >
      <td className="px-4 py-2.5">
        <div className="font-medium text-white truncate max-w-[16rem]">{u.email}</div>
        <div className="text-xs text-gray-500 font-mono truncate max-w-[16rem]">
          {u.user_id}
        </div>
      </td>
      <Td align="right">
        <span className={isOverCap ? 'text-red-300' : isNearCap ? 'text-amber-300' : ''}>
          {u.haiku_tokens_today.toLocaleString()}
        </span>
        {isOverCap && (
          <span className="ml-1 text-[10px] uppercase text-red-400">over cap</span>
        )}
      </Td>
      <Td align="right">{u.haiku_tokens_30d.toLocaleString()}</Td>
      <Td align="right">{u.sonnet_tokens_30d.toLocaleString()}</Td>
      <Td align="right">${u.estimated_cost_30d_usd.toFixed(2)}</Td>
      <Td align="right">{u.cap_hits_30d}</Td>
      <Td align="right">{u.daemon_count}</Td>
    </tr>
  );
}

function Th({ children, align }: { children: React.ReactNode; align: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align: 'left' | 'right';
}) {
  return (
    <td className={`px-4 py-2.5 ${align === 'right' ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  );
}

function CsvButton({ data }: { data: CostDashboardResponse | null }) {
  const csv = useMemo(() => buildCsv(data), [data]);
  const disabled = !data || data.users.length === 0;

  const handleClick = () => {
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadspot-cost-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  );
}

function buildCsv(data: CostDashboardResponse | null): string | null {
  if (!data) return null;
  const header = [
    'user_id',
    'email',
    'haiku_tokens_today',
    'haiku_tokens_30d',
    'sonnet_tokens_30d',
    'estimated_cost_30d_usd',
    'cap_hits_30d',
    'daemon_count',
  ];
  const rows = data.users.map((u) =>
    [
      u.user_id,
      u.email.replace(/,/g, ' '),
      u.haiku_tokens_today,
      u.haiku_tokens_30d,
      u.sonnet_tokens_30d,
      u.estimated_cost_30d_usd.toFixed(4),
      u.cap_hits_30d,
      u.daemon_count,
    ].join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
