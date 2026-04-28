'use client';

import { useState, useEffect, useCallback } from 'react';

type TaskType = 'all' | 'followup' | 'call' | 'email';

interface VoiceCallSummary {
  id: string;
  summary: string | null;
  phoneNumber: string;
  direction: string;
}

interface Task {
  id: string;
  contactId: string;
  type: string;
  notes: string | null;
  dueAt: string;
  completedAt: string | null;
  source: string;
  callId: string | null;
  createdAt: string;
  voiceCall: VoiceCallSummary | null;
}

const TYPE_LABELS: Record<string, string> = {
  followup: 'Follow-up',
  call: 'Call',
  email: 'Email',
};

const SOURCE_LABELS: Record<string, string> = {
  voice_agent: 'Voice Agent',
  manual: 'Manual',
};

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isOverdue = date < now && !isNaN(date.getTime());
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return isOverdue ? `${formatted} (overdue)` : formatted;
}

function isDueDateOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);

  const loadTasks = useCallback(async (type: TaskType) => {
    setLoading(true);
    setError(null);

    try {
      const url = type === 'all' ? '/api/tasks' : `/api/tasks?type=${type}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to load tasks');
      }

      const data: Task[] = await res.json();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(filter);
  }, [filter, loadTasks]);

  const handleMarkComplete = async (taskId: string) => {
    setMarkingComplete(taskId);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'PATCH' });

      if (!res.ok) {
        throw new Error('Failed to update task');
      }

      // Update local state — mark the task as complete without a full reload
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, completedAt: new Date().toISOString() } : t
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark task complete');
    } finally {
      setMarkingComplete(null);
    }
  };

  const pendingTasks = tasks.filter((t) => !t.completedAt);
  const completedTasks = tasks.filter((t) => t.completedAt);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="mt-1 text-sm text-gray-400">
            Follow-ups and action items from voice calls and manual entries
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'followup', 'call', 'email'] as TaskType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {type === 'all' ? 'All' : TYPE_LABELS[type] ?? type}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-400 text-sm">Loading tasks...</div>
          </div>
        ) : tasks.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No tasks</p>
            <p className="text-gray-500 text-sm mt-1">
              {filter === 'all'
                ? 'Tasks created by voice agents or manually will appear here.'
                : `No ${TYPE_LABELS[filter] ?? filter} tasks found.`}
            </p>
          </div>
        ) : (
          <>
            {/* Pending tasks table */}
            {pendingTasks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Pending ({pendingTasks.length})
                </h2>
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Contact</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Due Date</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Notes</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Source</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {pendingTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 text-gray-200 font-mono text-xs">
                            {task.contactId}
                          </td>
                          <td
                            className={`px-4 py-3 text-xs ${
                              isDueDateOverdue(task.dueAt)
                                ? 'text-red-400 font-medium'
                                : 'text-gray-300'
                            }`}
                          >
                            {formatDueDate(task.dueAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-900/40 text-cyan-300 border border-cyan-800/50">
                              {TYPE_LABELS[task.type] ?? task.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 max-w-xs">
                            <span className="line-clamp-2">
                              {task.notes ??
                                (task.voiceCall?.summary
                                  ? task.voiceCall.summary
                                  : '—')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                task.source === 'voice_agent'
                                  ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50'
                                  : 'bg-gray-700/60 text-gray-300 border border-gray-600/50'
                              }`}
                            >
                              {SOURCE_LABELS[task.source] ?? task.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleMarkComplete(task.id)}
                              disabled={markingComplete === task.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-900/40 text-green-300 border border-green-800/50 hover:bg-green-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {markingComplete === task.id ? 'Saving...' : 'Mark Complete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Completed tasks table */}
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Completed ({completedTasks.length})
                </h2>
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden opacity-60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Contact</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Completed</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Notes</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {completedTasks.map((task) => (
                        <tr key={task.id} className="line-through text-gray-500">
                          <td className="px-4 py-3 font-mono text-xs">{task.contactId}</td>
                          <td className="px-4 py-3 text-xs">
                            {task.completedAt
                              ? new Date(task.completedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {TYPE_LABELS[task.type] ?? task.type}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <span className="line-clamp-1">{task.notes ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {SOURCE_LABELS[task.source] ?? task.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
