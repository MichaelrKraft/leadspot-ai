'use client';

import { useAnalytics, useUsageStats } from '@/hooks/useAdmin';
import UsageChart from '@/components/admin/UsageChart';
import { Download, TrendingUp, Users, Search, FileText } from 'lucide-react';

export default function AnalyticsPage() {
  const { analytics, loading: analyticsLoading } = useAnalytics();
  const { stats, loading: statsLoading } = useUsageStats();

  const handleExportReport = () => {
    // TODO: Implement report export
    console.log('Exporting analytics report...');
  };

  if (analyticsLoading || statsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usage Analytics</h1>
          <p className="mt-2 text-gray-600">Monitor platform usage and performance metrics</p>
        </div>
        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Download className="h-5 w-5" />
          Export Report
        </button>
      </div>

      {/* Summary Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.totalUsers}</div>
          <div className="mt-1 text-sm text-gray-600">Total Users</div>
          <div className="mt-2 text-xs font-medium text-green-600">
            +{stats?.newUsersThisMonth} this month
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.activeUsers}</div>
          <div className="mt-1 text-sm text-gray-600">Active Users</div>
          <div className="mt-2 text-xs font-medium text-gray-500">Last 30 days</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Search className="h-5 w-5 text-green-600" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.totalQueries}</div>
          <div className="mt-1 text-sm text-gray-600">Total Queries</div>
          <div className="mt-2 text-xs font-medium text-green-600">
            {stats?.queriesThisMonth} this month
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <FileText className="h-5 w-5 text-orange-600" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.totalDocuments}</div>
          <div className="mt-1 text-sm text-gray-600">Total Documents</div>
          <div className="mt-2 text-xs font-medium text-gray-500">Indexed</div>
        </div>
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Query Volume Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {analytics?.queryVolume && (
            <UsageChart
              data={analytics.queryVolume}
              title="Query Volume (Last 30 Days)"
              type="line"
              color="#3b82f6"
            />
          )}
        </div>

        {/* Active Users Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {analytics?.activeUsers && (
            <UsageChart
              data={analytics.activeUsers}
              title="Active Users (Last 30 Days)"
              type="bar"
              color="#8b5cf6"
            />
          )}
        </div>
      </div>

      {/* Document Growth Chart */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        {analytics?.documentGrowth && (
          <UsageChart
            data={analytics.documentGrowth}
            title="Document Growth (Last 12 Months)"
            type="line"
            color="#10b981"
          />
        )}
      </div>

      {/* Top Users Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Users by Query Volume</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">User</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                  Query Count
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Activity</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.topUsers.map((user, index) => (
                <tr
                  key={user.userId}
                  className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-sm font-medium text-white">
                        {user.userName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{user.userName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-gray-900">{user.queryCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-2 w-24 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{
                            width: `${(user.queryCount / analytics.topUsers[0].queryCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs text-gray-500">
                        {Math.round((user.queryCount / analytics.topUsers[0].queryCount) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
