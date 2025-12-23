'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/hooks/useAdmin';
import AuditLogTable from '@/components/admin/AuditLogTable';
import { Download, Calendar, Filter } from 'lucide-react';
import type { AuditAction } from '@/types/admin';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { logs, loading } = useAuditLogs({
    action: actionFilter !== 'all' ? actionFilter : undefined,
    startDate,
    endDate,
  });

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Exporting audit logs...');
    const csvContent = [
      ['Action', 'User', 'Email', 'Timestamp', 'IP Address'].join(','),
      ...logs.map((log) =>
        [log.action, log.userName, log.userEmail, log.timestamp, log.ipAddress || 'N/A'].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-gray-600">Track all system activities and user actions</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Action Type Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Actions</option>
              <option value="user.login">User Login</option>
              <option value="user.created">User Created</option>
              <option value="user.updated">User Updated</option>
              <option value="user.deleted">User Deleted</option>
              <option value="document.uploaded">Document Uploaded</option>
              <option value="document.deleted">Document Deleted</option>
              <option value="query.executed">Query Executed</option>
              <option value="settings.updated">Settings Updated</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {(actionFilter !== 'all' || startDate || endDate) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {actionFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                Action: {actionFilter}
                <button
                  onClick={() => setActionFilter('all')}
                  className="rounded-full p-0.5 hover:bg-blue-200"
                >
                  ×
                </button>
              </span>
            )}
            {startDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700">
                From: {startDate}
                <button
                  onClick={() => setStartDate('')}
                  className="rounded-full p-0.5 hover:bg-purple-200"
                >
                  ×
                </button>
              </span>
            )}
            {endDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                To: {endDate}
                <button
                  onClick={() => setEndDate('')}
                  className="rounded-full p-0.5 hover:bg-green-200"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">Showing {logs.length} log entries</div>

      {/* Audit Logs Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <AuditLogTable logs={logs} />
      </div>
    </div>
  );
}
