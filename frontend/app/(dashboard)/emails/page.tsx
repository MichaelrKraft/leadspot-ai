'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface Email {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentCount: number;
  openRate: string;
  clickRate: string;
  dateModified: string;
}

const DEMO_EMAILS: Email[] = [
  { id: '1', name: 'Welcome Email', subject: 'Welcome to LeadSpot!', status: 'published', sentCount: 3200, openRate: '45%', clickRate: '22%', dateModified: 'Mar 15, 2026' },
  { id: '2', name: 'Q1 Newsletter', subject: 'Your March Marketing Digest', status: 'published', sentCount: 2100, openRate: '34%', clickRate: '12%', dateModified: 'Mar 20, 2026' },
  { id: '3', name: 'Follow-up Template', subject: 'Great talking with you!', status: 'draft', sentCount: 0, openRate: '-', clickRate: '-', dateModified: 'Mar 25, 2026' },
  { id: '4', name: 'Product Update', subject: 'New features just launched', status: 'published', sentCount: 1800, openRate: '38%', clickRate: '15%', dateModified: 'Mar 10, 2026' },
  { id: '5', name: 'Webinar Invite', subject: "You're invited: CRM Best Practices", status: 'published', sentCount: 890, openRate: '41%', clickRate: '18%', dateModified: 'Mar 22, 2026' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    draft: 'bg-slate-100 text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>(DEMO_EMAILS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Emails</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Create and send email templates to your contacts and segments.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New Email
        </button>
      </div>

      {/* Emails Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-800/50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Sent</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Open</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Click</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50">
            {emails.map((email) => (
              <tr key={email.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/30">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{email.name}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{email.subject}</p>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={email.status} />
                </td>
                <td className="px-6 py-4 text-right text-sm text-slate-700 dark:text-zinc-300">{email.sentCount.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-zinc-100">{email.openRate}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-zinc-100">{email.clickRate}</td>
                <td className="px-6 py-4 text-right text-xs text-slate-400 dark:text-zinc-500">{email.dateModified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Email Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Email</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const email: Email = {
                  id: `new-${Date.now()}`,
                  name: form.name,
                  subject: form.subject,
                  status: 'draft',
                  sentCount: 0,
                  openRate: '-',
                  clickRate: '-',
                  dateModified: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                };
                setEmails(prev => [email, ...prev]);
                setForm({ name: '', subject: '', body: '' });
                setShowModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Email Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Spring Open House Invite"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Subject Line *</label>
                <input
                  required
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. You're invited to our Spring Open House!"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Email Body</label>
                <textarea
                  rows={6}
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Write your email content..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500">
                  Create Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
