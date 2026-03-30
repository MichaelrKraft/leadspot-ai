/**
 * Shared types, demo data, and helpers for Dashboard + Timeline pages.
 * Extracted to keep page components under 400 lines.
 */
import { type ReactNode, createElement } from 'react';
import { Phone, Mail, MessageSquare, FileText, BrainCircuit, DollarSign, CheckCircle2, MapPin } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

export interface HotLead {
  firstname: string;
  lastname: string;
  company: string;
  points: number;
}

export interface CrmStats {
  total_contacts: number;
  total_emails: number;
  total_campaigns: number;
  total_segments: number;
}

export interface PipelineBrief {
  greeting: string;
  summary: string;
  new_leads: number;
  follow_ups_needed: number;
  deals_at_risk: number;
  suggested_actions: { id: string; title: string; description: string }[];
}

export interface AgentSuggestion {
  id: string;
  type: 'email' | 'call' | 'task' | 'deal' | 'note';
  title: string;
  description: string;
  contact_name: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  type: 'call' | 'email' | 'text' | 'note' | 'ai_action' | 'deal';
  title: string;
  description: string;
  contact_name: string;
  timestamp: string;
}

// ── Demo Data ──────────────────────────────────────────────────

export const DEMO_LEADS: HotLead[] = [
  { firstname: 'Sarah', lastname: 'Johnson', company: 'Acme Corp', points: 2450 },
  { firstname: 'Mike', lastname: 'Chen', company: 'TechStart', points: 1820 },
  { firstname: 'Lisa', lastname: 'Park', company: 'Growth Labs', points: 1540 },
  { firstname: 'James', lastname: 'Wilson', company: 'Innovate Inc', points: 1290 },
  { firstname: 'Emma', lastname: 'Davis', company: 'Scale Up', points: 1105 },
];

export const DEMO_STATS: CrmStats = {
  total_contacts: 3942,
  total_emails: 47,
  total_campaigns: 12,
  total_segments: 8,
};

export const DEMO_INSIGHTS = `Sarah Johnson has visited your pricing page 4 times this week. Consider reaching out with a personalized proposal.

Your "Holiday Sale" campaign has a 34% open rate - 12% above average. Great subject line performance!

3 contacts from TechStart have engaged recently. This could be a hot company account worth prioritizing.`;

export const DEMO_BRIEF: PipelineBrief = {
  greeting: 'Here\'s your AI morning brief',
  summary: 'You have 7 new leads overnight, 4 follow-ups due today, and 2 deals that need attention before they go cold.',
  new_leads: 7,
  follow_ups_needed: 4,
  deals_at_risk: 2,
  suggested_actions: [
    { id: 'a1', title: 'Follow up with Sarah Johnson', description: 'She visited pricing 4x this week - send a proposal' },
    { id: 'a2', title: 'Re-engage Mike Chen', description: 'No response in 5 days - try a different angle' },
    { id: 'a3', title: 'Send case study to Growth Labs', description: 'Lisa Park downloaded your whitepaper yesterday' },
  ],
};

export const DEMO_QUEUE: AgentSuggestion[] = [
  { id: 'q1', type: 'email', title: 'Send follow-up email', description: 'Draft a personalized follow-up based on pricing page visits', contact_name: 'Sarah Johnson', created_at: '2026-03-28T09:00:00Z' },
  { id: 'q2', type: 'call', title: 'Schedule discovery call', description: 'Mike showed interest in enterprise plan features', contact_name: 'Mike Chen', created_at: '2026-03-28T08:30:00Z' },
  { id: 'q3', type: 'task', title: 'Update deal stage', description: 'Move to "Proposal Sent" after yesterday\'s meeting', contact_name: 'Lisa Park', created_at: '2026-03-28T08:00:00Z' },
  { id: 'q4', type: 'note', title: 'Add meeting notes', description: 'Summarize key takeaways from yesterday\'s demo', contact_name: 'James Wilson', created_at: '2026-03-27T17:00:00Z' },
];

export const DEMO_ACTIVITY: TimelineEvent[] = [
  { id: 'e1', type: 'email', title: 'Email opened', description: 'Opened "Q1 Product Update" campaign email', contact_name: 'Sarah Johnson', timestamp: '2026-03-28T10:15:00Z' },
  { id: 'e2', type: 'call', title: 'Outbound call completed', description: '12 min call - discussed pricing and next steps', contact_name: 'Mike Chen', timestamp: '2026-03-28T09:45:00Z' },
  { id: 'e3', type: 'ai_action', title: 'AI scored lead', description: 'Lead score updated from 1200 to 1540 based on engagement', contact_name: 'Lisa Park', timestamp: '2026-03-28T09:30:00Z' },
  { id: 'e4', type: 'deal', title: 'Deal stage changed', description: 'Moved from "Qualified" to "Proposal" stage', contact_name: 'James Wilson', timestamp: '2026-03-28T09:00:00Z' },
  { id: 'e5', type: 'text', title: 'SMS sent', description: 'Appointment reminder for tomorrow at 2 PM', contact_name: 'Emma Davis', timestamp: '2026-03-28T08:30:00Z' },
  { id: 'e6', type: 'note', title: 'Note added', description: 'Client prefers quarterly billing, needs SOC2 compliance docs', contact_name: 'Sarah Johnson', timestamp: '2026-03-27T16:00:00Z' },
  { id: 'e7', type: 'email', title: 'Email replied', description: 'Responded to proposal with questions about API limits', contact_name: 'Mike Chen', timestamp: '2026-03-27T15:30:00Z' },
  { id: 'e8', type: 'ai_action', title: 'AI suggested follow-up', description: 'Recommended sending case study based on browsing behavior', contact_name: 'Lisa Park', timestamp: '2026-03-27T14:00:00Z' },
];

// ── Helpers ────────────────────────────────────────────────────

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 17) return 'Good afternoon!';
  return 'Good evening!';
}

export function formatNumber(num: number): string {
  if (num >= 1000) return num.toLocaleString();
  return num.toString();
}

export function getEventIcon(type: string): ReactNode {
  const iconMap: Record<string, [typeof Phone, string]> = {
    call: [Phone, 'text-blue-500'],
    email: [Mail, 'text-amber-500'],
    text: [MessageSquare, 'text-green-500'],
    note: [FileText, 'text-purple-500'],
    ai_action: [BrainCircuit, 'text-indigo-500'],
    deal: [DollarSign, 'text-emerald-500'],
  };
  const entry = iconMap[type];
  if (entry) return createElement(entry[0], { size: 16, className: entry[1] });
  return createElement(MapPin, { size: 16, className: 'text-slate-400' });
}

export function getSuggestionIcon(type: string): ReactNode {
  const iconMap: Record<string, [typeof Phone, string]> = {
    email: [Mail, 'text-amber-500'],
    call: [Phone, 'text-blue-500'],
    task: [CheckCircle2, 'text-green-500'],
    deal: [DollarSign, 'text-emerald-500'],
    note: [FileText, 'text-purple-500'],
  };
  const entry = iconMap[type];
  if (entry) return createElement(entry[0], { size: 16, className: entry[1] });
  return createElement(MapPin, { size: 16, className: 'text-slate-400' });
}

export function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
