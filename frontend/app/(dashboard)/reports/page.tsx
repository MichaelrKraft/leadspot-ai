'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getReportsSummary, ReportsSummary } from '@/lib/api/reports';

const DEMO_DATA: ReportsSummary = {
  total_contacts: 3942,
  active_campaigns: 4,
  total_deals: 47,
  pipeline_value: 128500,
  campaigns_performance: [
    { name: 'Holiday Sale 2026', leads: 120, opened: 49, replied: 12, open_rate: 41 },
    { name: 'Product Launch', leads: 95, opened: 36, replied: 9, open_rate: 38 },
    { name: 'Q1 Welcome Series', leads: 80, opened: 27, replied: 7, open_rate: 34 },
    { name: 'Re-engagement Flow', leads: 60, opened: 13, replied: 3, open_rate: 22 },
  ],
  top_segments: [
    { name: 'Newsletter Subscribers', contacts: 2100 },
    { name: 'Churned Contacts', contacts: 534 },
    { name: 'Hot Leads', contacts: 342 },
    { name: 'Webinar Attendees', contacts: 178 },
    { name: 'Enterprise', contacts: 89 },
  ],
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportsSummary>(DEMO_DATA);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getReportsSummary()
      .then(setData)
      .catch(() => {
        // Fall back to demo data silently
      })
      .finally(() => setIsLoading(false));
  }, []);

  const stats = [
    { label: 'Total Contacts', value: isLoading ? '—' : data.total_contacts.toLocaleString() },
    { label: 'Active Campaigns', value: isLoading ? '—' : String(data.active_campaigns) },
    { label: 'Total Deals', value: isLoading ? '—' : String(data.total_deals) },
    {
      label: 'Pipeline Value',
      value: isLoading
        ? '—'
        : '$' + (data.pipeline_value / 1000).toFixed(1) + 'k',
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          View analytics and performance reports for your CRM activity.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800/50 dark:bg-zinc-900"
          >
            <p className="text-sm text-slate-400 dark:text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-zinc-100">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Two-Column Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campaign Performance */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900">
          <h2 className="mb-5 text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Campaign Performance
          </h2>
          <div className="space-y-4">
            {data.campaigns_performance.map((campaign) => (
              <div key={campaign.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-zinc-300">{campaign.name}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {campaign.open_rate}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                    style={{ width: `${Math.min(campaign.open_rate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.campaigns_performance.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-zinc-500">No campaigns yet.</p>
            )}
          </div>
        </div>

        {/* Top Performing Segments */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900">
          <h2 className="mb-5 text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Top Performing Segments
          </h2>
          <div className="space-y-4">
            {data.top_segments.map((segment) => (
              <div key={segment.name} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate text-sm text-slate-700 dark:text-zinc-300">
                      {segment.name}
                    </span>
                    <span className="ml-2 flex-shrink-0 text-xs text-slate-400 dark:text-zinc-500">
                      {segment.contacts.toLocaleString()} contacts
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                      style={{
                        width: `${Math.min(
                          (segment.contacts /
                            Math.max(...data.top_segments.map((s) => s.contacts), 1)) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="w-20 text-right text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  {segment.contacts.toLocaleString()}
                </span>
              </div>
            ))}
            {data.top_segments.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-zinc-500">No segments yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-zinc-800/50 dark:bg-zinc-900">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Generate custom reports using the{' '}
          <Link
            href="/command-center"
            className="font-medium text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            AI Command Center
          </Link>
        </p>
      </div>
    </div>
  );
}
