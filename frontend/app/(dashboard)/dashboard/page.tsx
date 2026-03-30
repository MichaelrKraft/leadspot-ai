'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, Sparkles, BrainCircuit, CheckCircle2, Activity } from 'lucide-react';
import { fetchDailyInsights } from '@/lib/api/dashboard';
import {
  fetchPipelineBrief,
  fetchApprovalQueue,
  fetchRecentActivity,
  approveAction,
  dismissAction,
} from '@/lib/api/agent';
import {
  type HotLead,
  type CrmStats,
  type PipelineBrief,
  type AgentSuggestion,
  type TimelineEvent,
  DEMO_LEADS,
  DEMO_STATS,
  DEMO_INSIGHTS,
  DEMO_BRIEF,
  DEMO_QUEUE,
  DEMO_ACTIVITY,
  getGreeting,
  formatNumber,
  getEventIcon,
  getSuggestionIcon,
  formatTimestamp,
} from '@/lib/dashboard-demo-data';

export default function DashboardPage() {
  const [hotLeads, setHotLeads] = useState<HotLead[]>(DEMO_LEADS);
  const [stats, setStats] = useState<CrmStats | null>(DEMO_STATS);
  const [insights, setInsights] = useState<string>(DEMO_INSIGHTS);
  const [isLoading, setIsLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(true);

  const [brief, setBrief] = useState<PipelineBrief>(DEMO_BRIEF);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [queue, setQueue] = useState<AgentSuggestion[]>(DEMO_QUEUE);
  const [activity, setActivity] = useState<TimelineEvent[]>(DEMO_ACTIVITY);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

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
        setDemoMode(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPipelineBrief()
      .then((data) => { if (data) setBrief(data as unknown as PipelineBrief); })
      .catch(() => { /* keep demo data */ });

    fetchApprovalQueue()
      .then((data) => { if (Array.isArray(data) && data.length) setQueue(data as unknown as AgentSuggestion[]); })
      .catch(() => { /* keep demo data */ });

    fetchRecentActivity()
      .then((data) => { if (Array.isArray(data) && data.length) setActivity(data as unknown as TimelineEvent[]); })
      .catch(() => { /* keep demo data */ });
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await approveAction(id);
      setQueue((prev) => prev.filter((item) => item.id !== id));
      setBrief((prev) => ({
        ...prev,
        suggested_actions: prev.suggested_actions.filter((a) => a.id !== id),
      }));
    } catch {
      /* keep item visible on error */
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDismiss = async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await dismissAction(id);
      setQueue((prev) => prev.filter((item) => item.id !== id));
      setBrief((prev) => ({
        ...prev,
        suggested_actions: prev.suggested_actions.filter((a) => a.id !== id),
      }));
    } catch {
      /* keep item visible on error */
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

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
            <BarChart3 size={18} className="text-indigo-500" />
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
            <Sparkles size={18} className="text-amber-500" />
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

      {/* AI Morning Brief Card - Full Width */}
      <div className="w-full mb-5">
        <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-400/10">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800/50 bg-gradient-to-br from-indigo-400/5 to-transparent">
            <div className="flex items-center gap-2.5">
              <BrainCircuit size={18} className="text-indigo-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">AI Morning Brief</span>
            </div>
            <button
              onClick={() => setBriefExpanded(!briefExpanded)}
              className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
            >
              {briefExpanded ? 'Collapse' : 'View Full Brief'}
            </button>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">{brief.summary}</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { value: brief.new_leads, label: 'New Leads', color: 'text-green-500 dark:text-green-400' },
                { value: brief.follow_ups_needed, label: 'Follow-ups', color: 'text-amber-500 dark:text-amber-400' },
                { value: brief.deals_at_risk, label: 'At Risk', color: 'text-red-500 dark:text-red-400' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800/50">
                  <span className={`block text-2xl font-bold mb-1 ${stat.color}`}>{stat.value}</span>
                  <span className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                </div>
              ))}
            </div>
            {briefExpanded && brief.suggested_actions.length > 0 && (
              <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800/50 pt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Suggested Actions</p>
                {brief.suggested_actions.map((action) => (
                  <div key={action.id} className="flex items-start justify-between gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{action.title}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{action.description}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(action.id)}
                        disabled={actionLoading[action.id]}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDismiss(action.id)}
                        disabled={actionLoading[action.id]}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Queue + Recent Activity - Two Column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full mb-8">
        {/* Approval Queue Card */}
        <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-400/10">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800/50 bg-gradient-to-br from-indigo-400/5 to-transparent">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Approval Queue</span>
            </div>
            <Link href="/timeline" className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
              View All
            </Link>
          </div>
          <div className="px-5 py-4 min-h-[100px]">
            {queue.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-4">No pending suggestions</p>
            ) : (
              <div className="space-y-3">
                {queue.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0">{getSuggestionIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-50 truncate">{item.title}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{item.description}</p>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{item.contact_name}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoading[item.id]}
                        className="p-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                      <button
                        onClick={() => handleDismiss(item.id)}
                        disabled={actionLoading[item.id]}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        title="Dismiss"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed Card */}
        <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-400/10">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800/50 bg-gradient-to-br from-indigo-400/5 to-transparent">
            <div className="flex items-center gap-2.5">
              <Activity size={18} className="text-blue-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Recent Activity</span>
            </div>
            <Link href="/timeline" className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
              View All
            </Link>
          </div>
          <div className="px-5 py-4 min-h-[100px] max-h-[320px] overflow-y-auto">
            {activity.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-4">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {activity.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0">{getEventIcon(event.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-50 truncate">{event.title}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{event.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-indigo-500 dark:text-indigo-400">{event.contact_name}</span>
                        <span className="text-xs text-slate-300 dark:text-zinc-700">{'\u{2022}'}</span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500">{formatTimestamp(event.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
