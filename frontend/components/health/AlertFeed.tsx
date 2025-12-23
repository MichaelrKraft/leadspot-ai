// Alert Feed Component

'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import type { HealthAlert, AlertSeverity } from '@/types/health';
import AlertCard from './AlertCard';

interface AlertFeedProps {
  alerts: HealthAlert[];
  groupBySeverity?: boolean;
  maxItems?: number;
  compact?: boolean;
  showLoadMore?: boolean;
}

export default function AlertFeed({
  alerts,
  groupBySeverity = false,
  maxItems,
  compact = false,
  showLoadMore = false
}: AlertFeedProps) {
  const [displayCount, setDisplayCount] = useState(maxItems || alerts.length);

  // Group alerts by severity
  const groupedAlerts = groupBySeverity
    ? {
        critical: alerts.filter(a => a.severity === 'critical'),
        warning: alerts.filter(a => a.severity === 'warning'),
        info: alerts.filter(a => a.severity === 'info')
      }
    : null;

  const displayedAlerts = alerts.slice(0, displayCount);
  const hasMore = displayCount < alerts.length;

  // Empty state
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          All Clear!
        </h3>
        <p className="text-sm text-gray-600 max-w-md">
          No active alerts found. Your knowledge base health is looking good.
        </p>
      </div>
    );
  }

  // Grouped view
  if (groupBySeverity && groupedAlerts) {
    return (
      <div className="space-y-6">
        {/* Critical Alerts */}
        {groupedAlerts.critical.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Critical ({groupedAlerts.critical.length})
            </h3>
            <div className="space-y-3">
              {groupedAlerts.critical.map(alert => (
                <AlertCard key={alert.id} alert={alert} compact={compact} />
              ))}
            </div>
          </div>
        )}

        {/* Warning Alerts */}
        {groupedAlerts.warning.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              Warnings ({groupedAlerts.warning.length})
            </h3>
            <div className="space-y-3">
              {groupedAlerts.warning.map(alert => (
                <AlertCard key={alert.id} alert={alert} compact={compact} />
              ))}
            </div>
          </div>
        )}

        {/* Info Alerts */}
        {groupedAlerts.info.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Information ({groupedAlerts.info.length})
            </h3>
            <div className="space-y-3">
              {groupedAlerts.info.map(alert => (
                <AlertCard key={alert.id} alert={alert} compact={compact} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default list view
  return (
    <div className="space-y-3">
      {displayedAlerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} compact={compact} />
      ))}

      {/* Load More Button */}
      {showLoadMore && hasMore && (
        <button
          onClick={() => setDisplayCount(prev => prev + (maxItems || 10))}
          className="w-full py-3 px-4 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Load More ({alerts.length - displayCount} remaining)
        </button>
      )}
    </div>
  );
}
