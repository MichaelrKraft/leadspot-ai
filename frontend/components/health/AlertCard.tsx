// Individual Alert Card Component

'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  FileWarning,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import clsx from 'clsx';
import type { HealthAlert, AlertSeverity, AlertType } from '@/types/health';
import { useUpdateAlertStatus } from '@/hooks/useHealth';

interface AlertCardProps {
  alert: HealthAlert;
  compact?: boolean;
}

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  const updateStatus = useUpdateAlertStatus();

  // Get icon based on alert type
  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'conflict':
        return AlertTriangle;
      case 'outdated':
        return FileWarning;
      case 'gap':
        return AlertCircle;
      case 'quality':
        return Info;
      default:
        return AlertCircle;
    }
  };

  // Get color classes based on severity
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-700',
          icon: 'text-red-600'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-500',
          text: 'text-yellow-700',
          icon: 'text-yellow-600'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-500',
          text: 'text-blue-700',
          icon: 'text-blue-600'
        };
    }
  };

  const Icon = getAlertIcon(alert.type);
  const colors = getSeverityColor(alert.severity);

  const handleResolve = async (e: React.MouseEvent) => {
    e.preventDefault();
    await updateStatus.mutateAsync({
      alertId: alert.id,
      status: 'resolved'
    });
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    await updateStatus.mutateAsync({
      alertId: alert.id,
      status: 'dismissed'
    });
  };

  return (
    <Link href={`/health/alerts/${alert.id}`}>
      <div
        className={clsx(
          'relative border-l-4 rounded-lg p-4 transition-all hover:shadow-md cursor-pointer',
          colors.bg,
          colors.border,
          compact ? 'p-3' : 'p-4'
        )}
      >
        {/* Severity Bar (left border handled by border-l-4) */}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={clsx('flex-shrink-0', colors.icon)}>
            <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3
                  className={clsx(
                    'font-semibold',
                    colors.text,
                    compact ? 'text-sm' : 'text-base'
                  )}
                >
                  {alert.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      colors.bg,
                      colors.text
                    )}
                  >
                    {alert.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              {alert.status !== 'active' && (
                <span
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    alert.status === 'resolved'
                      ? 'bg-green-100 text-green-700'
                      : alert.status === 'dismissed'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-blue-100 text-blue-700'
                  )}
                >
                  {alert.status}
                </span>
              )}
            </div>

            {/* Description */}
            {!compact && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                {alert.description}
              </p>
            )}

            {/* Affected Documents */}
            {alert.affected_documents.length > 0 && (
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>
                  Affects {alert.affected_documents.length} document
                  {alert.affected_documents.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Quick Actions */}
            {alert.status === 'active' && !compact && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleResolve}
                  disabled={updateStatus.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Resolve
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={updateStatus.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3 h-3" />
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
