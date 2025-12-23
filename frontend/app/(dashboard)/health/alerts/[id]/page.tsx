// Alert Detail Page

'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, AlertTriangle } from 'lucide-react';
import { useHealthAlert, useUpdateAlertStatus } from '@/hooks/useHealth';
import ConflictView from '@/components/health/ConflictView';
import GapAnalysis from '@/components/health/GapAnalysis';
import clsx from 'clsx';

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const { data: alert, isLoading, error } = useHealthAlert(alertId);
  const updateStatus = useUpdateAlertStatus();

  const handleStatusChange = async (status: 'resolved' | 'dismissed' | 'in_progress') => {
    await updateStatus.mutateAsync({ alertId, status });
  };

  const handleResolve = async () => {
    await handleStatusChange('resolved');
    router.push('/health/alerts');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-gray-600">Loading alert details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold text-red-600">Failed to load alert</div>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={() => router.push('/health/alerts')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Alerts
          </button>
        </div>
      </div>
    );
  }

  if (!alert) return null;

  // Get severity color classes
  const getSeverityColor = () => {
    switch (alert.severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-700',
          badge: 'bg-red-100 text-red-800',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-500',
          text: 'text-yellow-700',
          badge: 'bg-yellow-100 text-yellow-800',
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-500',
          text: 'text-blue-700',
          badge: 'bg-blue-100 text-blue-800',
        };
    }
  };

  const colors = getSeverityColor();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/health/alerts')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all alerts
      </button>

      {/* Alert Header */}
      <div className={clsx('rounded-lg border-l-4 p-6', colors.bg, colors.border)}>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', colors.badge)}>
                {alert.severity}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                {alert.type}
              </span>
              {alert.status !== 'active' && (
                <span
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    alert.status === 'resolved'
                      ? 'bg-green-100 text-green-800'
                      : alert.status === 'dismissed'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-100 text-blue-800'
                  )}
                >
                  {alert.status}
                </span>
              )}
            </div>
            <h1 className={clsx('mb-2 text-2xl font-bold', colors.text)}>{alert.title}</h1>
            <p className="text-gray-700">{alert.description}</p>
          </div>

          {/* Action Buttons */}
          {alert.status === 'active' && (
            <div className="ml-4 flex flex-col gap-2">
              <button
                onClick={handleResolve}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Resolve
              </button>
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
              >
                <Clock className="h-4 w-4" />
                In Progress
              </button>
              <button
                onClick={() => handleStatusChange('dismissed')}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 border-t border-gray-200 pt-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Created: {new Date(alert.created_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>
              {alert.affected_documents.length} affected document
              {alert.affected_documents.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Affected Documents */}
      {alert.affected_documents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Affected Documents</h2>
          <div className="space-y-2">
            {alert.affected_documents.map((docId, index) => (
              <a
                key={index}
                href={`/documents/${docId}`}
                className="block rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Document {docId}</div>
                    <div className="text-xs text-gray-500">Click to view document</div>
                  </div>
                  <ArrowLeft className="h-4 w-4 rotate-180 text-gray-400" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Type-Specific Content */}
      {alert.type === 'conflict' && alert.metadata?.conflict_details && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <ConflictView
            conflict={alert.metadata.conflict_details}
            onResolve={async (resolution) => {
              console.log('Resolution applied:', resolution);
              await handleResolve();
            }}
          />
        </div>
      )}

      {alert.type === 'gap' && alert.metadata?.gap_details && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Gap Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Topic</label>
              <p className="mt-1 text-gray-900">{alert.metadata.gap_details.topic}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Coverage Score</label>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${alert.metadata.gap_details.coverage_score}%`,
                    }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {alert.metadata.gap_details.coverage_score}%
                </span>
              </div>
            </div>

            {alert.metadata.gap_details.related_queries.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Related Queries
                </label>
                <ul className="space-y-2">
                  {alert.metadata.gap_details.related_queries.map((query, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1 text-blue-600">•</span>
                      <span>{query}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {alert.metadata.gap_details.suggested_sources && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Suggested Sources
                </label>
                <ul className="space-y-2">
                  {alert.metadata.gap_details.suggested_sources.map((source, idx) => (
                    <li key={idx} className="text-sm text-blue-600 hover:text-blue-700">
                      {source}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {alert.type === 'quality' && alert.metadata?.quality_issues && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quality Issues</h2>
          <ul className="space-y-2">
            {alert.metadata.quality_issues.map((issue, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                <span className="text-sm text-gray-700">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* History/Audit Trail */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Activity History</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 border-b border-gray-200 pb-3">
            <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Alert Created</div>
              <div className="text-xs text-gray-500">
                {new Date(alert.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {alert.updated_at !== alert.created_at && (
            <div className="flex items-start gap-3">
              <div className="mt-2 h-2 w-2 rounded-full bg-gray-400"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Alert Updated</div>
                <div className="text-xs text-gray-500">
                  {new Date(alert.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
