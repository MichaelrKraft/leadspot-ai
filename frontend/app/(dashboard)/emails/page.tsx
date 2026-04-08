'use client';

import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { listEmails, createEmail } from '@/lib/api/emails';
import type { Email as ApiEmail } from '@/lib/api/emails';

interface EmailRow {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentCount: number;
  openRate: string;
  clickRate: string;
  dateModified: string;
}

function apiEmailToRow(e: ApiEmail): EmailRow {
  return {
    id: e.id,
    name: e.subject,
    subject: `${e.email_type} · ${e.to_addr}`,
    status: e.status === 'Sent' ? 'published' : e.status.toLowerCase(),
    sentCount: e.status === 'Sent' ? 1 : 0,
    openRate: e.opened ? '100%' : '-',
    clickRate: '-',
    dateModified: new Date(e.updated_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

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
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  async function fetchEmails() {
    try {
      setLoading(true);
      setError(null);
      const data = await listEmails({ limit: 50 });
      setEmails(data.emails.map(apiEmailToRow));
    } catch {
      setError('Failed to load emails. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmails();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createEmail({
        subject: form.name,
        from_addr: 'demo@leadspot.ai',
        to_addr: form.subject,
        body: form.body,
        status: 'Draft',
        email_type: 'Outbound',
      });
      setForm({ name: '', subject: '', body: '' });
      setShowModal(false);
      await fetchEmails();
    } catch {
      setError('Failed to create email. Please try again.');
    } finally {
      setSaving(false);
    }
  }

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

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
          <span>{error}</span>
          <button onClick={fetchEmails} className="ml-4 font-medium underline">Retry</button>
        </div>
      )}

      {/* Emails Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-900">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400 dark:text-zinc-500">
            Loading emails…
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400 dark:text-zinc-500">
            No emails yet. Create your first email above.
          </div>
        ) : (
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
        )}
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
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Email Subject *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Spring Open House Invite"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">To (recipient email) *</label>
                <input
                  required
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. contact@example.com"
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
                <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Create Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
