'use client';

import { useState } from 'react';
import { Clock, Plus, Play, Pause, Trash2, Calendar } from 'lucide-react';

interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  nextRun: string;
  lastRun?: string;
  status: 'active' | 'paused';
  agentType: string;
}

// Demo data - will be replaced with API calls
const demoTasks: ScheduledTask[] = [
  {
    id: '1',
    name: 'Weekly Performance Report',
    prompt: 'Generate a campaign performance report for last week',
    schedule: 'Every Monday @ 9:00 AM',
    nextRun: 'Dec 30, 2025',
    lastRun: 'Dec 23, 2025',
    status: 'active',
    agentType: 'Analytics Agent',
  },
  {
    id: '2',
    name: 'Hourly Lead Tagger',
    prompt: 'Tag high-value leads who visited pricing page 3+ times',
    schedule: 'Every hour',
    nextRun: 'In 45 minutes',
    lastRun: '15 minutes ago',
    status: 'active',
    agentType: 'Contact Agent',
  },
  {
    id: '3',
    name: 'Monthly Inactive Cleanup',
    prompt: 'Archive contacts with no activity in 6 months',
    schedule: '1st of each month @ 2:00 AM',
    nextRun: 'Jan 1, 2026',
    status: 'paused',
    agentType: 'Contact Agent',
  },
];

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>(demoTasks);

  const toggleTaskStatus = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId
        ? { ...task, status: task.status === 'active' ? 'paused' : 'active' }
        : task
    ));
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Scheduled Tasks
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Automate your AI agents to run on a schedule
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">
          <Plus className="h-5 w-5" />
          New Task
        </button>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-3 ${
                  task.status === 'active'
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Calendar className={`h-6 w-6 ${
                    task.status === 'active'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {task.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {task.prompt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      {task.schedule}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {task.agentType}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Next run: <span className="font-medium">{task.nextRun}</span>
                    {task.lastRun && (
                      <span className="ml-4">Last run: {task.lastRun}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`rounded-lg p-2 transition-colors ${
                    task.status === 'active'
                      ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                      : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                  title={task.status === 'active' ? 'Pause' : 'Resume'}
                >
                  {task.status === 'active' ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <button
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-16">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No scheduled tasks
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Create your first scheduled task to automate your AI agents
          </p>
        </div>
      )}
    </div>
  );
}
