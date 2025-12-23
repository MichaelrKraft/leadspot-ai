'use client';

import { useAdminStats, useRecentActivity } from '@/hooks/useAdmin';
import { Users, FileText, Search, HardDrive, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { stats, loading: statsLoading } = useAdminStats();
  const { activity, loading: activityLoading } = useRecentActivity();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_joined':
        return Users;
      case 'document_added':
        return FileText;
      case 'query_executed':
        return Search;
      default:
        return Clock;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  if (statsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">Overview of your organization</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <Link
              href="/admin/users"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.users.total}</div>
          <div className="mt-1 text-sm text-gray-600">Total Users</div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="font-medium text-green-600">{stats?.users.active} active</span>
            <span className="font-medium text-yellow-600">{stats?.users.pending} pending</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <Search className="h-6 w-6 text-purple-600" />
            </div>
            <Link
              href="/admin/analytics"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Analytics
            </Link>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.queries.total}</div>
          <div className="mt-1 text-sm text-gray-600">Total Queries</div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="font-medium text-blue-600">{stats?.queries.today} today</span>
            <span className="font-medium text-gray-600">{stats?.queries.thisWeek} this week</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <Link
              href="/admin/analytics"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View
            </Link>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.documents.total}</div>
          <div className="mt-1 text-sm text-gray-600">Total Documents</div>
          <div className="mt-3 text-xs">
            <span className="font-medium text-green-600">
              +{stats?.documents.thisMonth} this month
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
            <Link
              href="/admin/organization"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Manage
            </Link>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.storage.used} GB</div>
          <div className="mt-1 text-sm text-gray-600">Storage Used</div>
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-orange-600"
                style={{
                  width: `${((stats?.storage?.used ?? 0) / (stats?.storage?.limit ?? 1)) * 100}%`,
                }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500">{stats?.storage.limit} GB limit</div>
          </div>
        </div>
      </div>

      {/* Quick Links and Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Links */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/admin/users/invite"
              className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Invite User</span>
              </div>
              <span className="text-gray-400">→</span>
            </Link>

            <Link
              href="/admin/users"
              className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Manage Users</span>
              </div>
              <span className="text-gray-400">→</span>
            </Link>

            <Link
              href="/admin/analytics"
              className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">View Analytics</span>
              </div>
              <span className="text-gray-400">→</span>
            </Link>

            <Link
              href="/admin/audit"
              className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Audit Logs</span>
              </div>
              <span className="text-gray-400">→</span>
            </Link>

            <Link
              href="/admin/organization"
              className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Organization Settings</span>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h2>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <div className="border-3 h-6 w-6 animate-spin rounded-full border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {activity.map((item) => {
                const Icon = getActivityIcon(item.type);
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{item.description}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatTimeAgo(item.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">System Status</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <div>
              <div className="text-sm font-medium text-gray-900">API Server</div>
              <div className="text-xs text-gray-500">Operational</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <div>
              <div className="text-sm font-medium text-gray-900">Database</div>
              <div className="text-xs text-gray-500">Healthy</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <div>
              <div className="text-sm font-medium text-gray-900">Document Processing</div>
              <div className="text-xs text-gray-500">Running</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
