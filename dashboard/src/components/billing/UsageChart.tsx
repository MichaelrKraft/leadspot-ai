'use client';

import { useMemo } from 'react';

interface DailyUsage {
  date: string;
  minutes: number;
  cost: number;
  calls: number;
}

interface UsageStats {
  totalMinutes: number;
  totalCost: number;
  totalMargin: number;
  callCount: number;
}

interface Props {
  dailyUsage: DailyUsage[];
  stats: UsageStats;
  period: 'day' | 'week' | 'month' | 'all';
  onPeriodChange?: (period: 'day' | 'week' | 'month' | 'all') => void;
  loading?: boolean;
}

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
  { value: 'all', label: 'All Time' },
] as const;

export function UsageChart({ dailyUsage, stats, period, onPeriodChange, loading }: Props) {
  // Calculate chart dimensions and data
  const chartData = useMemo(() => {
    if (!dailyUsage || dailyUsage.length === 0) {
      return { bars: [], maxMinutes: 0 };
    }

    // Sort by date ascending
    const sorted = [...dailyUsage].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const maxMinutes = Math.max(...sorted.map((d) => d.minutes), 1);

    const bars = sorted.map((day) => ({
      ...day,
      heightPercent: (day.minutes / maxMinutes) * 100,
      formattedDate: new Date(day.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));

    return { bars, maxMinutes };
  }, [dailyUsage]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] p-6 animate-pulse">
        <div className="h-6 bg-[#2a2a2a] rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-[#2a2a2a] rounded mb-4"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#2a2a2a] rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Voice Usage</h3>
          {onPeriodChange && (
            <div className="flex gap-1 bg-[#0a0a0a] rounded-lg p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPeriodChange(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    period === opt.value
                      ? 'bg-[#00D9FF] text-black font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="p-6 border-b border-[#2a2a2a]">
        {chartData.bars.length > 0 ? (
          <div className="h-48 flex items-end gap-1">
            {chartData.bars.map((bar, index) => (
              <div
                key={bar.date}
                className="flex-1 flex flex-col items-center group"
              >
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs whitespace-nowrap absolute transform -translate-y-full">
                  <p className="text-white font-medium">{bar.formattedDate}</p>
                  <p className="text-gray-400">{bar.minutes.toFixed(1)} mins</p>
                  <p className="text-gray-400">{bar.calls} calls</p>
                  <p className="text-[#00D9FF]">{formatCurrency(bar.cost)}</p>
                </div>
                
                {/* Bar */}
                <div
                  className="w-full bg-[#00D9FF]/80 hover:bg-[#00D9FF] rounded-t transition-all cursor-pointer"
                  style={{ height: `${Math.max(bar.heightPercent, 2)}%` }}
                />
                
                {/* Date label - show every few bars to avoid crowding */}
                {(index % Math.ceil(chartData.bars.length / 7) === 0 || index === chartData.bars.length - 1) && (
                  <span className="text-gray-500 text-xs mt-2 transform -rotate-45 origin-top-left">
                    {bar.formattedDate}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-500">
            No usage data for this period
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0a0a0a] rounded-lg p-4">
            <p className="text-gray-500 text-xs mb-1">Total Minutes</p>
            <p className="text-xl font-bold text-white">
              {stats.totalMinutes.toFixed(1)}
            </p>
          </div>
          <div className="bg-[#0a0a0a] rounded-lg p-4">
            <p className="text-gray-500 text-xs mb-1">Total Calls</p>
            <p className="text-xl font-bold text-white">{stats.callCount}</p>
          </div>
          <div className="bg-[#0a0a0a] rounded-lg p-4">
            <p className="text-gray-500 text-xs mb-1">Total Spend</p>
            <p className="text-xl font-bold text-[#00D9FF]">
              {formatCurrency(stats.totalCost)}
            </p>
          </div>
          <div className="bg-[#0a0a0a] rounded-lg p-4">
            <p className="text-gray-500 text-xs mb-1">Avg per Call</p>
            <p className="text-xl font-bold text-white">
              {stats.callCount > 0
                ? (stats.totalMinutes / stats.callCount).toFixed(1)
                : '0'}{' '}
              <span className="text-sm font-normal text-gray-500">mins</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
