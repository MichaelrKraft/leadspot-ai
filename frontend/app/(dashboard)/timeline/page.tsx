'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { Phone, Mail, MessageSquare, FileText, BrainCircuit, DollarSign, MapPin } from 'lucide-react';
import { fetchRecentActivity } from '@/lib/api/agent';

interface TimelineEvent {
  id: string;
  type: 'call' | 'email' | 'text' | 'note' | 'ai_action' | 'deal';
  title: string;
  description: string;
  contact_name: string;
  timestamp: string;
}

type EventType = TimelineEvent['type'];

const EVENT_TYPES: { key: EventType; label: string; icon: string; color: string }[] = [
  { key: 'call', label: 'Calls', icon: <Phone size={14} />, color: 'bg-blue-500/10 text-blue-500 dark:text-blue-400' },
  { key: 'email', label: 'Emails', icon: <Mail size={14} />, color: 'bg-amber-500/10 text-amber-500 dark:text-amber-400' },
  { key: 'text', label: 'Texts', icon: <MessageSquare size={14} />, color: 'bg-green-500/10 text-green-500 dark:text-green-400' },
  { key: 'note', label: 'Notes', icon: <FileText size={14} />, color: 'bg-purple-500/10 text-purple-500 dark:text-purple-400' },
  { key: 'ai_action', label: 'AI Actions', icon: <BrainCircuit size={14} />, color: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' },
  { key: 'deal', label: 'Deals', icon: <DollarSign size={14} />, color: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
];

const DEMO_EVENTS: TimelineEvent[] = [
  { id: 'e1', type: 'email', title: 'Email opened', description: 'Opened "Q1 Product Update" campaign email', contact_name: 'Sarah Johnson', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'e2', type: 'call', title: 'Outbound call completed', description: '12 min call - discussed pricing and next steps', contact_name: 'Mike Chen', timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
  { id: 'e3', type: 'ai_action', title: 'AI scored lead', description: 'Lead score updated from 1200 to 1540 based on engagement', contact_name: 'Lisa Park', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
  { id: 'e4', type: 'deal', title: 'Deal stage changed', description: 'Moved from "Qualified" to "Proposal" stage', contact_name: 'James Wilson', timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
  { id: 'e5', type: 'text', title: 'SMS sent', description: 'Appointment reminder for tomorrow at 2 PM', contact_name: 'Emma Davis', timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString() },
  { id: 'e6', type: 'note', title: 'Note added', description: 'Client prefers quarterly billing, needs SOC2 compliance docs', contact_name: 'Sarah Johnson', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
  { id: 'e7', type: 'email', title: 'Email replied', description: 'Responded to proposal with questions about API limits', contact_name: 'Mike Chen', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 27).toISOString() },
  { id: 'e8', type: 'ai_action', title: 'AI suggested follow-up', description: 'Recommended sending case study based on browsing behavior', contact_name: 'Lisa Park', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString() },
  { id: 'e9', type: 'call', title: 'Missed call', description: 'Attempted outbound call - no answer, left voicemail', contact_name: 'James Wilson', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString() },
  { id: 'e10', type: 'email', title: 'Campaign email sent', description: 'Sent "Feature Spotlight: AI Agents" to 234 contacts', contact_name: 'Bulk Campaign', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
  { id: 'e11', type: 'deal', title: 'New deal created', description: 'Enterprise plan - $24,000/year potential', contact_name: 'Sarah Johnson', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString() },
  { id: 'e12', type: 'text', title: 'SMS received', description: 'Confirmed meeting for Thursday at 10 AM', contact_name: 'Emma Davis', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString() },
  { id: 'e13', type: 'ai_action', title: 'AI auto-segmented', description: 'Added to "High Intent" segment based on behavior patterns', contact_name: 'Mike Chen', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString() },
  { id: 'e14', type: 'note', title: 'Meeting notes saved', description: 'Demo went well, decision maker is the VP of Engineering', contact_name: 'Lisa Park', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString() },
  { id: 'e15', type: 'call', title: 'Discovery call completed', description: '28 min call - identified pain points and budget range', contact_name: 'Sarah Johnson', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString() },
];

function getDateGroup(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 86400000 * 7);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  return 'Earlier';
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getEventStyle(type: EventType): { icon: ReactNode; color: string } {
  const found = EVENT_TYPES.find((t) => t.key === type);
  return found
    ? { icon: found.icon, color: found.color }
    : { icon: <MapPin size={14} />, color: 'bg-gray-500/10 text-gray-500' };
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>(DEMO_EVENTS);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(new Set(EVENT_TYPES.map((t) => t.key)));
  const avgSpeedToLead = 4.2; // demo value in minutes

  useEffect(() => {
    fetchRecentActivity()
      .then((data) => {
        if (Array.isArray(data) && data.length) setEvents(data as unknown as TimelineEvent[]);
      })
      .catch(() => { /* keep demo data */ });
  }, []);

  const toggleFilter = (type: EventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filteredEvents = useMemo(
    () => events.filter((e) => activeFilters.has(e.type)),
    [events, activeFilters]
  );

  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    for (const label of order) {
      groups[label] = [];
    }
    for (const event of filteredEvents) {
      const group = getDateGroup(event.timestamp);
      if (!groups[group]) groups[group] = [];
      groups[group].push(event);
    }
    // Sort each group by timestamp descending
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return groups;
  }, [filteredEvents]);

  return (
    <div className="flex flex-col px-6 py-8 max-w-[900px] mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 mb-1">Activity Timeline</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">Track all interactions across your contacts</p>
      </div>

      {/* Speed to Lead Metric */}
      <div className="mb-6 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-5 transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Avg Speed to Lead</p>
            <p className="text-3xl font-bold text-indigo-500 dark:text-indigo-400">{avgSpeedToLead} <span className="text-base font-medium text-slate-400 dark:text-zinc-500">minutes</span></p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
              <path d="M7 17l5-5 5 5M7 7l5 5 5-5" />
            </svg>
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">12% faster</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {EVENT_TYPES.map((type) => {
          const isActive = activeFilters.has(type.key);
          return (
            <button
              key={type.key}
              onClick={() => toggleFilter(type.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                isActive
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-100 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600'
              }`}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline Feed */}
      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([group, groupEvents]) => {
          if (groupEvents.length === 0) return null;
          return (
            <div key={group}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{group}</h2>
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800/50" />
                <span className="text-xs text-slate-400 dark:text-zinc-600">{groupEvents.length} events</span>
              </div>
              <div className="space-y-2">
                {groupEvents.map((event) => {
                  const style = getEventStyle(event.type);
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-xl transition-all hover:border-indigo-300/30 dark:hover:border-indigo-400/30 hover:shadow-sm"
                    >
                      <div className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${style.color}`}>
                        <span>{style.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{event.title}</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{event.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Link
                            href={`/contacts`}
                            className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                          >
                            {event.contact_name}
                          </Link>
                          <span className="text-xs text-slate-300 dark:text-zinc-700">{'\u{2022}'}</span>
                          <span className="text-xs text-slate-400 dark:text-zinc-500">{formatTime(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 dark:text-zinc-500 text-sm">No events match your filters</p>
            <button
              onClick={() => setActiveFilters(new Set(EVENT_TYPES.map((t) => t.key)))}
              className="mt-2 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
