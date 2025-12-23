'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';

interface QuickStat {
  label: string;
  value: string;
  icon: string;
  trend?: string;
  trendUp?: boolean;
}

interface RecentQuery {
  id: string;
  query: string;
  timestamp: string;
  status: 'completed' | 'processing' | 'failed';
}

interface ConnectedSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'syncing' | 'error';
  lastSync?: string;
}

// Demo recent queries for bond trading / financial services
const DEMO_RECENT_QUERIES: RecentQuery[] = [
  {
    id: 'q1',
    query: 'What are current yield spreads on investment-grade corporate bonds vs treasuries?',
    timestamp: '2 hours ago',
    status: 'completed',
  },
  {
    id: 'q2',
    query: 'Show me all municipal bond trades over $5M from last week',
    timestamp: '5 hours ago',
    status: 'completed',
  },
  {
    id: 'q3',
    query: 'Which clients have ESG mandate requirements for fixed income?',
    timestamp: 'Yesterday',
    status: 'completed',
  },
  {
    id: 'q4',
    query: 'What is our current inventory exposure to BBB-rated bonds?',
    timestamp: 'Yesterday',
    status: 'completed',
  },
  {
    id: 'q5',
    query: 'Pull FINRA compliance reports for Q4 trade surveillance',
    timestamp: '2 days ago',
    status: 'completed',
  },
];

// Demo connected sources for bond trading / financial services
const DEMO_CONNECTED_SOURCES: ConnectedSource[] = [
  {
    id: 's1',
    name: 'Bloomberg Terminal',
    type: 'Market Data Feed',
    status: 'active',
    lastSync: '2 minutes ago',
  },
  {
    id: 's2',
    name: 'FINRA TRACE',
    type: 'Trade Reporting',
    status: 'active',
    lastSync: '5 minutes ago',
  },
  {
    id: 's3',
    name: 'MSRB EMMA',
    type: 'Municipal Bond Data',
    status: 'active',
    lastSync: '15 minutes ago',
  },
  {
    id: 's4',
    name: 'Internal CRM',
    type: 'Client Database',
    status: 'syncing',
    lastSync: 'Syncing now...',
  },
  {
    id: 's5',
    name: 'Risk Management System',
    type: 'VaR & Position Limits',
    status: 'active',
    lastSync: '1 hour ago',
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<QuickStat[]>([]);

  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [connectedSources, setConnectedSources] = useState<ConnectedSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // TODO: Replace with actual API calls
        // const response = await fetch('/api/dashboard/stats');
        // const data = await response.json();
        // setStats(data.stats);
        // setRecentQueries(data.recentQueries);
        // setConnectedSources(data.connectedSources);

        // For now, use demo data
        setRecentQueries(DEMO_RECENT_QUERIES);
        setConnectedSources(DEMO_CONNECTED_SOURCES);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Fallback to demo data on error
        setRecentQueries(DEMO_RECENT_QUERIES);
        setConnectedSources(DEMO_CONNECTED_SOURCES);
      }
    };

    fetchDashboardData();
  }, []);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redirect to query page with search
      window.location.href = `/query?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
        return 'text-green-400 bg-green-500/10';
      case 'processing':
      case 'syncing':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'failed':
      case 'error':
        return 'text-red-400 bg-red-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Here's what's happening with your knowledge synthesis platform.
        </p>
      </div>

      {/* Quick Search - Large, prominent */}
      <div className="mb-8">
        <form onSubmit={handleQuickSearch}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask a question or search your knowledge base..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-5 pl-14 text-lg text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:shadow-md dark:border-gray-700 dark:bg-gray-800/60 dark:text-white dark:placeholder-gray-500"
            />
            <svg
              className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-blue-600 px-6 py-2.5 text-base font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Stats Grid - Only show when stats have real data */}
      {stats.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:bg-gray-50 dark:border-gray-700/50 dark:bg-gray-800/40 dark:hover:bg-gray-800/60"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl">{stat.icon}</span>
                {stat.trend && stat.trend !== '+0%' && stat.trend !== '-0%' && stat.trend !== '+0' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      stat.trendUp
                        ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                    }`}
                  >
                    {stat.trend}
                  </span>
                )}
              </div>
              <p className="mb-0.5 text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Queries */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Queries</h2>
            <Link
              href="/query"
              className="text-sm text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View all →
            </Link>
          </div>

          {recentQueries.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="mb-4 text-gray-500 dark:text-gray-400">No queries yet</p>
              <Link
                href="/query"
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
              >
                Create Your First Query
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentQueries.map((query) => (
                <div
                  key={query.id}
                  className="cursor-pointer rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <p className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                      {query.query}
                    </p>
                    <span
                      className={`ml-2 rounded-full px-2 py-1 text-xs ${getStatusColor(
                        query.status
                      )}`}
                    >
                      {query.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{query.timestamp}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected Sources */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connected Sources</h2>
            <Link
              href="/sources"
              className="text-sm text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Manage →
            </Link>
          </div>

          {connectedSources.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <p className="mb-4 text-gray-500 dark:text-gray-400">No sources connected</p>
              <Link
                href="/sources"
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
              >
                Connect Data Source
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {source.name}
                      </p>
                      <p className="text-xs text-gray-500">{source.type}</p>
                    </div>
                    <span
                      className={`ml-2 rounded-full px-2 py-1 text-xs ${getStatusColor(
                        source.status
                      )}`}
                    >
                      {source.status}
                    </span>
                  </div>
                  {source.lastSync && (
                    <p className="text-xs text-gray-500">Last sync: {source.lastSync}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Link
          href="/query"
          className="group rounded-2xl border border-gray-200 bg-white p-6 backdrop-blur-xl transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <div className="mb-4 text-4xl">🔍</div>
          <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            New Query
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask questions across your entire knowledge base
          </p>
        </Link>

        <Link
          href="/documents"
          className="group rounded-2xl border border-gray-200 bg-white p-6 backdrop-blur-xl transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <div className="mb-4 text-4xl">📄</div>
          <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
            Upload Documents
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add new documents to your knowledge base
          </p>
        </Link>

        <Link
          href="/settings/integrations"
          className="group rounded-2xl border border-gray-200 bg-white p-6 backdrop-blur-xl transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <div className="mb-4 text-4xl">🔗</div>
          <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-green-600 dark:text-white dark:group-hover:text-green-400">
            Connect Sources
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Link external data sources and APIs
          </p>
        </Link>
      </div>
    </div>
  );
}
