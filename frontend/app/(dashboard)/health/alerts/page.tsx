// All Alerts Page

'use client';

import { useState } from 'react';
import { Search, Filter, CheckSquare, XSquare } from 'lucide-react';
import { useHealthAlerts, useBulkUpdateAlerts } from '@/hooks/useHealth';
import AlertFeed from '@/components/health/AlertFeed';
import type { AlertType, AlertSeverity, AlertStatus, HealthFilter } from '@/types/health';

export default function AlertsPage() {
  const [filters, setFilters] = useState<HealthFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [groupBySeverity, setGroupBySeverity] = useState(true);

  const { data: alerts, isLoading, error } = useHealthAlerts(filters);
  const bulkUpdate = useBulkUpdateAlerts();

  // Apply search filter
  const filteredAlerts =
    alerts?.filter((alert) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        alert.title.toLowerCase().includes(query) || alert.description.toLowerCase().includes(query)
      );
    }) || [];

  const handleBulkResolve = async () => {
    if (selectedAlerts.length === 0) return;
    await bulkUpdate.mutateAsync({
      alertIds: selectedAlerts,
      status: 'resolved',
    });
    setSelectedAlerts([]);
  };

  const handleBulkDismiss = async () => {
    if (selectedAlerts.length === 0) return;
    await bulkUpdate.mutateAsync({
      alertIds: selectedAlerts,
      status: 'dismissed',
    });
    setSelectedAlerts([]);
  };

  const toggleFilter = <T extends string>(key: keyof HealthFilter, value: T) => {
    setFilters((prev) => {
      const current = prev[key] as T[] | undefined;
      if (!current) {
        return { ...prev, [key]: [value] };
      }
      if (current.includes(value)) {
        const updated = current.filter((v) => v !== value);
        return updated.length > 0 ? { ...prev, [key]: updated } : { ...prev, [key]: undefined };
      }
      return { ...prev, [key]: [...current, value] };
    });
  };

  const isFilterActive = <T extends string>(key: keyof HealthFilter, value: T): boolean => {
    const current = filters[key] as T[] | undefined;
    return current?.includes(value) || false;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-gray-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold text-red-600">Failed to load alerts</div>
          <p className="text-gray-600">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Alerts</h1>
          <p className="mt-1 text-gray-600">
            {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Bulk Actions */}
        {selectedAlerts.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{selectedAlerts.length} selected</span>
            <button
              onClick={handleBulkResolve}
              disabled={bulkUpdate.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
            >
              <CheckSquare className="h-4 w-4" />
              Resolve
            </button>
            <button
              onClick={handleBulkDismiss}
              disabled={bulkUpdate.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <XSquare className="h-4 w-4" />
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="space-y-3">
          {/* Type Filters */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase text-gray-600">Type</label>
            <div className="flex flex-wrap gap-2">
              {(['conflict', 'outdated', 'gap', 'quality'] as AlertType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleFilter('type', type)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    isFilterActive('type', type)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Filters */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase text-gray-600">
              Severity
            </label>
            <div className="flex flex-wrap gap-2">
              {(['critical', 'warning', 'info'] as AlertSeverity[]).map((severity) => (
                <button
                  key={severity}
                  onClick={() => toggleFilter('severity', severity)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    isFilterActive('severity', severity)
                      ? severity === 'critical'
                        ? 'bg-red-600 text-white'
                        : severity === 'warning'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filters */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase text-gray-600">Status</label>
            <div className="flex flex-wrap gap-2">
              {(['active', 'resolved', 'dismissed', 'in_progress'] as AlertStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => toggleFilter('status', status)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      isFilterActive('status', status)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace('_', ' ')}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        {(filters.type?.length || filters.severity?.length || filters.status?.length) && (
          <button
            onClick={() => setFilters({})}
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={groupBySeverity}
              onChange={(e) => setGroupBySeverity(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Group by severity</span>
          </label>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <AlertFeed
          alerts={filteredAlerts}
          groupBySeverity={groupBySeverity}
          showLoadMore={true}
          maxItems={20}
        />
      </div>
    </div>
  );
}
