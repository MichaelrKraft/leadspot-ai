'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchDailyInsights } from '@/lib/api/dashboard';

interface HotLead {
  firstname: string;
  lastname: string;
  company: string;
  points: number;
}

interface CrmStats {
  total_contacts: number;
  total_emails: number;
  total_campaigns: number;
  total_segments: number;
}

const DEMO_LEADS: HotLead[] = [
  { firstname: 'Sarah', lastname: 'Johnson', company: 'Acme Corp', points: 2450 },
  { firstname: 'Mike', lastname: 'Chen', company: 'TechStart', points: 1820 },
  { firstname: 'Lisa', lastname: 'Park', company: 'Growth Labs', points: 1540 },
  { firstname: 'James', lastname: 'Wilson', company: 'Innovate Inc', points: 1290 },
  { firstname: 'Emma', lastname: 'Davis', company: 'Scale Up', points: 1105 },
];

const DEMO_STATS: CrmStats = {
  total_contacts: 3942,
  total_emails: 47,
  total_campaigns: 12,
  total_segments: 8,
};

const DEMO_INSIGHTS = `\u{1F4C8} Sarah Johnson has visited your pricing page 4 times this week. Consider reaching out with a personalized proposal.

\u{1F3AF} Your "Holiday Sale" campaign has a 34% open rate - 12% above average. Great subject line performance!

\u{1F4A1} 3 contacts from TechStart have engaged recently. This could be a hot company account worth prioritizing.`;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 17) return 'Good afternoon!';
  return 'Good evening!';
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return num.toLocaleString();
  }
  return num.toString();
}

export default function DashboardPage() {
  const [hotLeads, setHotLeads] = useState<HotLead[]>(DEMO_LEADS);
  const [stats, setStats] = useState<CrmStats | null>(DEMO_STATS);
  const [insights, setInsights] = useState<string>(DEMO_INSIGHTS);
  const [isLoading, setIsLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(true);

  useEffect(() => {
    fetchDailyInsights()
      .then((data) => {
        if (data.hot_leads?.length) {
          setHotLeads(
            data.hot_leads.map((lead) => ({
              firstname: lead.firstname || '',
              lastname: lead.lastname || '',
              company: lead.company || '',
              points: lead.points || 0,
            }))
          );
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.ai_insights) {
          setInsights(data.ai_insights);
        }
        setDemoMode(!data.mautic_connected);
      })
      .catch(() => {
        // Demo data already set as initial state defaults
        setDemoMode(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col items-center px-6 py-8 max-w-[800px] mx-auto animate-in fade-in duration-300">
      {/* Greeting Header */}
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-bold text-slate-900 dark:text-zinc-50 mb-2">
          {getGreeting()}
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-zinc-400">
          Here&apos;s your daily briefing
          {demoMode && (
            <span className="ml-2 inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 text-xs px-2 py-0.5 rounded-full">
              Demo Mode
            </span>
          )}
        </p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full mb-8">
        {/* Hot Leads Card */}
        <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-400/10">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200 dark:border-zinc-800/50 bg-gradient-to-br from-indigo-400/5 to-transparent">
            <span className="text-lg">{'\u{1F525}'}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Hot Leads</span>
          </div>
          <div className="px-5 py-4 min-h-[100px]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-5 text-zinc-400 text-sm">
                <div className="w-4 h-4 border-2 border-slate-200 dark:border-zinc-700 border-t-indigo-400 rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : hotLeads.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-4">No leads data yet</p>
            ) : (
              hotLeads.slice(0, 5).map((lead, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-2.5 ${
                    i < hotLeads.length - 1 ? 'border-b border-slate-200 dark:border-zinc-800/50' : ''
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-900 dark:text-zinc-50">
                      {lead.firstname} {lead.lastname}
                    </span>
                    {lead.company && (
                      <span className="text-xs text-slate-400 dark:text-zinc-500">
                        {lead.company}
                      </span>
                    )}
                  </div>
                  <span className="bg-indigo-400/10 text-indigo-500 dark:text-indigo-400 px-2.5 py-1 rounded-full text-[13px] font-semibold">
                    {lead.points} pts
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CRM Stats Card */}
        <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-400/10">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200 dark:border-zinc-800/50 bg-gradient-to-br from-indigo-400/5 to-transparent">
            <span className="text-lg">{'\u{1F4CA}'}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">CRM Stats</span>
          </div>
          <div className="px-5 py-4 min-h-[100px]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-5 text-zinc-400 text-sm">
                <div className="w-4 h-4 border-2 border-slate-200 dark:border-zinc-700 border-t-indigo-400 rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: stats ? formatNumber(stats.total_contacts) : '-', label: 'Contacts' },
                  { value: stats ? formatNumber(stats.total_emails) : '-', label: 'Emails' },
                  { value: stats ? formatNumber(stats.total_campaigns) : '-', label: 'Campaigns' },
                  { value: stats ? formatNumber(stats.total_segments) : '-', label: 'Segments' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="text-center p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800/50"
                  >
                    <span className="block text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-1">
                      {item.value}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Insights Card - Full Width */}
        <div className="md:col-span-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-400/10">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200 dark:border-zinc-800/50 bg-gradient-to-br from-indigo-400/5 to-transparent">
            <span className="text-lg">{'\u{1F4A1}'}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">AI Insights</span>
          </div>
          <div className="px-5 py-4 min-h-[100px]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-5 text-zinc-400 text-sm">
                <div className="w-4 h-4 border-2 border-slate-200 dark:border-zinc-700 border-t-indigo-400 rounded-full animate-spin" />
                <span>Generating insights...</span>
              </div>
            ) : insights ? (
              <p className="text-sm leading-7 text-slate-600 dark:text-zinc-400 whitespace-pre-line">
                {insights}
              </p>
            ) : (
              <p className="text-center text-zinc-400 text-sm py-4">
                Connect Mautic to get AI-powered insights
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Start Chatting Button */}
      <Link
        href="/command-center"
        className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-gradient-to-br from-indigo-500 via-indigo-400 to-indigo-300 text-white rounded-full text-base font-semibold shadow-[0_4px_15px_rgba(129,140,248,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(129,140,248,0.4)] active:translate-y-0"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        Start Chatting
      </Link>
    </div>
  );
}
