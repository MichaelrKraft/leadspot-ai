'use client';

const DEMO_CAMPAIGNS = [
  { id: '1', name: 'Q1 Welcome Series', status: 'active', type: 'Email', contacts: 1247, sent: 3200, openRate: '34%', clickRate: '12%', dateCreated: 'Jan 15, 2026' },
  { id: '2', name: 'Holiday Sale 2026', status: 'active', type: 'Email', contacts: 892, sent: 2100, openRate: '41%', clickRate: '18%', dateCreated: 'Mar 1, 2026' },
  { id: '3', name: 'Webinar Follow-up', status: 'draft', type: 'Email', contacts: 0, sent: 0, openRate: '-', clickRate: '-', dateCreated: 'Mar 20, 2026' },
  { id: '4', name: 'Re-engagement Flow', status: 'paused', type: 'Email', contacts: 456, sent: 1800, openRate: '22%', clickRate: '8%', dateCreated: 'Feb 10, 2026' },
  { id: '5', name: 'Product Launch', status: 'active', type: 'SMS + Email', contacts: 2100, sent: 4500, openRate: '38%', clickRate: '15%', dateCreated: 'Mar 5, 2026' },
];

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

export default function CampaignsPage() {
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
        <button className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md">
          + New Campaign
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-800/50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Campaign</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Contacts</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Sent</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Open</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Click</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50">
            {DEMO_CAMPAIGNS.map((campaign) => (
              <tr key={campaign.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/30">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{campaign.name}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{campaign.type}</p>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="px-6 py-4 text-right text-sm text-slate-700 dark:text-zinc-300">{campaign.contacts.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700 dark:text-zinc-300">{campaign.sent.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-zinc-100">{campaign.openRate}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-zinc-100">{campaign.clickRate}</td>
                <td className="px-6 py-4 text-right text-xs text-slate-400 dark:text-zinc-500">{campaign.dateCreated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
