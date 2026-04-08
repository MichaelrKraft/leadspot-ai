'use client';

import { useEffect, useState } from 'react';
import { listSegments, createSegment, type Segment } from '@/lib/api/segments';

function TypeBadge({ filterType }: { filterType: string }) {
  return filterType === 'dynamic' ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
      Dynamic
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-400">
      Manual
    </span>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchSegments() {
    try {
      setError(null);
      const data = await listSegments();
      setSegments(data.segments);
    } catch (err) {
      setError('Failed to load segments.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSegments();
  }, []);

  async function handleNewSegment() {
    const name = prompt('Segment name:');
    if (!name?.trim()) return;
    try {
      await createSegment({ name: name.trim() });
      await fetchSegments();
    } catch {
      alert('Failed to create segment.');
    }
  }

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
        <button
          onClick={handleNewSegment}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
        >
          + New Segment
        </button>
      </div>

      {/* Loading / Error states */}
      {isLoading && (
        <p className="text-sm text-slate-400 dark:text-zinc-500">Loading segments...</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Table */}
      {!isLoading && !error && (
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
              {segments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400 dark:text-zinc-500">
                    No segments yet. Create your first segment.
                  </td>
                </tr>
              )}
              {segments.map((segment) => (
                <tr
                  key={segment.id}
                  className="transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: segment.color }}
                      />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-zinc-100">{segment.name}</p>
                        {segment.description && (
                          <p className="mt-0.5 text-sm text-slate-400 dark:text-zinc-500">
                            {segment.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {segment.contact_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <TypeBadge filterType={segment.filter_type} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 dark:text-zinc-500">
                    {new Date(segment.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
