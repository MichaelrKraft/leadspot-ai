'use client';

import Link from 'next/link';

// TODO: Wire to backend — replace STATS/CAMPAIGN_PERFORMANCE/TOP_SEGMENTS with API calls
const STATS = [
  { label: 'Total Contacts', value: '3,942', change: '+12%', changeLabel: 'this month' },
  { label: 'Emails Sent', value: '12,400', change: '+8%', changeLabel: 'this month' },
  { label: 'Open Rate', value: '36%', change: '+3%', changeLabel: 'vs last month' },
  { label: 'Meetings Booked', value: '47', change: '+15%', changeLabel: 'this month' },
];

const CAMPAIGN_PERFORMANCE = [
  { name: 'Holiday Sale 2026', openRate: 41 },
  { name: 'Product Launch', openRate: 38 },
  { name: 'Q1 Welcome Series', openRate: 34 },
  { name: 'Re-engagement Flow', openRate: 22 },
];

const TOP_SEGMENTS = [
  { name: 'Newsletter Subscribers', contacts: 2100, engagement: 85 },
  { name: 'Churned Contacts', contacts: 534, engagement: 42 },
  { name: 'Hot Leads', contacts: 342, engagement: 95 },
  { name: 'Webinar Attendees', contacts: 178, engagement: 72 },
  { name: 'Enterprise', contacts: 89, engagement: 88 },
];

export default function ReportsPage() {
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
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800/50 dark:bg-zinc-900"
          >
            <p className="text-sm text-slate-400 dark:text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-zinc-100">{stat.value}</p>
            <p className="mt-1 text-xs">
              <span className="font-medium text-green-600 dark:text-green-400">{stat.change}</span>
              <span className="ml-1 text-slate-400 dark:text-zinc-500">{stat.changeLabel}</span>
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
            {CAMPAIGN_PERFORMANCE.map((campaign) => (
              <div key={campaign.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-zinc-300">{campaign.name}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {campaign.openRate}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                    style={{ width: `${campaign.openRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Segments */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900">
          <h2 className="mb-5 text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Top Performing Segments
          </h2>
          <div className="space-y-4">
            {TOP_SEGMENTS.map((segment) => (
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
                      style={{ width: `${segment.engagement}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-right text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {segment.engagement}
                </span>
              </div>
            ))}
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
