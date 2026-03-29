'use client';

import { InboxContact } from '@/types/inbox';

interface ContactSidebarProps {
  contact: InboxContact | null;
}

const RECENT_ACTIVITY = [
  { label: 'Opened email: Q1 Proposal', time: '2h ago' },
  { label: 'Visited pricing page', time: '5h ago' },
  { label: 'Downloaded whitepaper', time: '1d ago' },
  { label: 'Clicked CTA in newsletter', time: '2d ago' },
  { label: 'Submitted contact form', time: '5d ago' },
];

export default function ContactSidebar({ contact }: ContactSidebarProps) {
  if (!contact) {
    return (
      <div className="w-full border-l dark:border-zinc-800/50 border-slate-200 p-6 overflow-y-auto hidden lg:flex items-center justify-center">
        <p className="text-sm dark:text-zinc-500 text-slate-400">
          No contact selected
        </p>
      </div>
    );
  }

  return (
    <div className="w-full border-l dark:border-zinc-800/50 border-slate-200 p-6 overflow-y-auto hidden lg:block">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-300 flex items-center justify-center text-white text-2xl font-bold mb-3">
          {contact.name.charAt(0)}
        </div>
        <h3 className="text-base font-semibold dark:text-zinc-100 text-slate-900">
          {contact.name}
        </h3>
        <p className="text-sm dark:text-zinc-400 text-slate-500">
          {contact.company}
        </p>
        <p className="text-xs dark:text-zinc-500 text-slate-400 mt-1">
          {contact.email}
        </p>
      </div>

      {/* Points Badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
          {contact.points.toLocaleString()} pts
        </span>
      </div>

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            Tags
          </h4>
          <div className="flex flex-wrap gap-2">
            {contact.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xs font-medium dark:bg-zinc-800 bg-slate-100 dark:text-zinc-300 text-slate-600 dark:border dark:border-zinc-700/50 border border-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          Recent Activity
        </h4>
        <div className="space-y-3">
          {RECENT_ACTIVITY.map((activity, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs dark:text-zinc-300 text-slate-700 leading-relaxed">
                  {activity.label}
                </p>
                <p className="text-[11px] dark:text-zinc-500 text-slate-400">
                  {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
