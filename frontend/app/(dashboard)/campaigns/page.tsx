'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import {
  listCampaigns,
  createCampaign,
  deleteCampaign,
  type Campaign,
} from '@/lib/api/campaigns';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    draft: 'bg-slate-100 text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Email' });

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listCampaigns();
      setCampaigns(data.campaigns);
    } catch {
      setError('Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createCampaign({ name: form.name, type: form.type, status: 'draft' });
      setForm({ name: '', type: 'Email' });
      setShowModal(false);
      await loadCampaigns();
    } catch {
      setError('Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch {
      setError('Failed to delete campaign');
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Manage your marketing campaigns and automation workflows.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
        </div>
      ) : (
        /* Campaigns Table */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-900">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800/50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Leads</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Opened</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Replied</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
                    No campaigns yet. Create your first campaign to get started.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{campaign.name}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500">{campaign.type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-700 dark:text-zinc-300">{campaign.leads.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-zinc-100">{campaign.opened.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-zinc-100">{campaign.replied.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400 dark:text-zinc-500">{formatDate(campaign.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(campaign.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                        aria-label="Delete campaign"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Campaign</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Campaign Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Spring Open House Invite"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="SMS + Email">SMS + Email</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
