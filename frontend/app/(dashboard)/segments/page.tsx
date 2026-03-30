'use client';

// TODO: Wire to backend — replace DEMO_SEGMENTS with API call to /api/segments
const DEMO_SEGMENTS = [
  { id: '1', name: 'Hot Leads', description: 'Contacts with 100+ engagement points', contacts: 342, isPublic: true, dateCreated: 'Jan 5, 2026' },
  { id: '2', name: 'Enterprise', description: 'Companies with 50+ employees', contacts: 89, isPublic: true, dateCreated: 'Jan 12, 2026' },
  { id: '3', name: 'Newsletter Subscribers', description: 'Opted in to weekly newsletter', contacts: 2100, isPublic: true, dateCreated: 'Dec 1, 2025' },
  { id: '4', name: 'Webinar Attendees', description: 'Attended any webinar in last 90 days', contacts: 178, isPublic: false, dateCreated: 'Feb 15, 2026' },
  { id: '5', name: 'Trial Users', description: 'Active trial accounts', contacts: 67, isPublic: true, dateCreated: 'Mar 1, 2026' },
  { id: '6', name: 'Churned Contacts', description: 'No activity in 60+ days', contacts: 534, isPublic: false, dateCreated: 'Feb 20, 2026' },
];

function TypeBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
      Public
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-400">
      Private
    </span>
  );
}

export default function SegmentsPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Segments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Create and manage contact segments for targeted campaigns.
          </p>
        </div>
        <button className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md">
          + New Segment
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-800/50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Contacts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Date Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50">
            {DEMO_SEGMENTS.map((segment) => (
              <tr
                key={segment.id}
                className="transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/30"
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-zinc-100">{segment.name}</p>
                    <p className="mt-0.5 text-sm text-slate-400 dark:text-zinc-500">
                      {segment.description}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {segment.contacts.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <TypeBadge isPublic={segment.isPublic} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-400 dark:text-zinc-500">
                  {segment.dateCreated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
