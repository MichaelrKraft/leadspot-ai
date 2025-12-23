// Main Health Dashboard Page

'use client';

import { RefreshCw, Filter, Download } from 'lucide-react';
import { useState } from 'react';
import { useHealthDashboard, useTriggerScan } from '@/hooks/useHealth';
import HealthScore from '@/components/health/HealthScore';
import HealthStats from '@/components/health/HealthStats';
import AlertFeed from '@/components/health/AlertFeed';
import GapAnalysis from '@/components/health/GapAnalysis';
import type { AlertType, AlertSeverity } from '@/types/health';

export default function HealthDashboardPage() {
  const { data: dashboard, isLoading, error, refetch } = useHealthDashboard();
  const triggerScan = useTriggerScan();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<AlertType[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<AlertSeverity[]>([]);

  // Filter alerts
  const filteredAlerts =
    dashboard?.recent_alerts.filter((alert) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(alert.type)) {
        return false;
      }
      if (selectedSeverities.length > 0 && !selectedSeverities.includes(alert.severity)) {
        return false;
      }
      return true;
    }) || [];

  const handleScan = async () => {
    await triggerScan.mutateAsync();
    setTimeout(() => refetch(), 1000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-gray-600">Loading health dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold text-red-600">
            Failed to load health dashboard
          </div>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Knowledge Health</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Monitor the health and quality of your knowledge base. Your health score reflects data consistency,
            freshness, and completeness across all connected sources.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            We scan for <span className="font-medium text-red-600 dark:text-red-400">conflicts</span> between documents,
            <span className="font-medium text-yellow-600 dark:text-yellow-400"> outdated</span> information,
            <span className="font-medium text-blue-600 dark:text-blue-400"> knowledge gaps</span>, and
            <span className="font-medium text-purple-600 dark:text-purple-400"> quality</span> issues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={dashboard.stats.scan_in_progress || triggerScan.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${dashboard.stats.scan_in_progress ? 'animate-spin' : ''}`}
            />
            {dashboard.stats.scan_in_progress ? 'Scanning...' : 'Trigger Scan'}
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>

          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Quick Filters */}
      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Type Filters */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Alert Type</label>
              <div className="flex flex-wrap gap-2">
                {(['conflict', 'outdated', 'gap', 'quality'] as AlertType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedTypes((prev) =>
                        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      selectedTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filters */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Severity</label>
              <div className="flex flex-wrap gap-2">
                {(['critical', 'warning', 'info'] as AlertSeverity[]).map((severity) => (
                  <button
                    key={severity}
                    onClick={() => {
                      setSelectedSeverities((prev) =>
                        prev.includes(severity)
                          ? prev.filter((s) => s !== severity)
                          : [...prev, severity]
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      selectedSeverities.includes(severity)
                        ? severity === 'critical'
                          ? 'bg-red-600 text-white'
                          : severity === 'warning'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {severity}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedTypes.length > 0 || selectedSeverities.length > 0) && (
            <button
              onClick={() => {
                setSelectedTypes([]);
                setSelectedSeverities([]);
              }}
              className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <HealthStats stats={dashboard.stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Health Score - Large Column */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <HealthScore
              score={dashboard.health_score}
              trend={dashboard.score_trend}
              lastUpdated={dashboard.stats.last_scan}
              size="lg"
            />
          </div>
        </div>

        {/* Alert Feed - Large Column */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Recent Alerts</h2>
              <a
                href="/health/alerts"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All →
              </a>
            </div>

            <AlertFeed alerts={filteredAlerts} maxItems={5} showLoadMore={false} compact={true} />
          </div>
        </div>
      </div>

      {/* Gap Analysis */}
      {dashboard.gap_analysis && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Knowledge Gap Analysis</h2>
          <GapAnalysis analysis={dashboard.gap_analysis} />
        </div>
      )}
    </div>
  );
}
