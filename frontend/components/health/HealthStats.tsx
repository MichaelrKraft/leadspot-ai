// Health Stats Cards Grid

'use client';

import {
  FileText,
  AlertTriangle,
  HelpCircle,
  Calendar,
  FileWarning
} from 'lucide-react';
import clsx from 'clsx';
import type { HealthStats as HealthStatsType } from '@/types/health';

interface HealthStatsProps {
  stats: HealthStatsType;
  className?: string;
}

export default function HealthStats({ stats, className }: HealthStatsProps) {
  // Format last scan time
  const formatScanTime = (time: string | null) => {
    if (!time) return 'Never';
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const statCards = [
    {
      label: 'Total Documents',
      value: stats.total_documents.toLocaleString(),
      icon: FileText,
      color: 'blue',
      description: 'In knowledge base'
    },
    {
      label: 'Active Alerts',
      value: stats.active_alerts.toLocaleString(),
      icon: AlertTriangle,
      color: stats.active_alerts > 10 ? 'red' : stats.active_alerts > 0 ? 'yellow' : 'green',
      description: 'Requiring attention'
    },
    {
      label: 'Knowledge Gaps',
      value: stats.knowledge_gaps.toLocaleString(),
      icon: HelpCircle,
      color: stats.knowledge_gaps > 5 ? 'yellow' : 'blue',
      description: 'Identified topics'
    },
    {
      label: 'Documents at Risk',
      value: stats.documents_at_risk.toLocaleString(),
      icon: FileWarning,
      color: stats.documents_at_risk > 0 ? 'red' : 'green',
      description: 'Need review'
    },
    {
      label: 'Last Scan',
      value: formatScanTime(stats.last_scan),
      icon: Calendar,
      color: 'gray',
      description: stats.scan_in_progress ? 'Scan in progress...' : 'Health check'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; text: string }> = {
      blue: {
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        text: 'text-blue-700'
      },
      green: {
        bg: 'bg-green-50',
        icon: 'text-green-600',
        text: 'text-green-700'
      },
      yellow: {
        bg: 'bg-yellow-50',
        icon: 'text-yellow-600',
        text: 'text-yellow-700'
      },
      red: {
        bg: 'bg-red-50',
        icon: 'text-red-600',
        text: 'text-red-700'
      },
      gray: {
        bg: 'bg-gray-50',
        icon: 'text-gray-600',
        text: 'text-gray-700'
      }
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4', className)}>
      {statCards.map((stat, index) => {
        const colors = getColorClasses(stat.color);
        const Icon = stat.icon;

        return (
          <div
            key={index}
            className={clsx(
              'rounded-lg p-4 border transition-shadow hover:shadow-md',
              colors.bg,
              'border-gray-200'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={clsx('p-2 rounded-lg', colors.bg)}>
                <Icon className={clsx('w-5 h-5', colors.icon)} />
              </div>
            </div>

            <div className="mt-2">
              <div className={clsx('text-2xl font-bold', colors.text)}>
                {stat.value}
              </div>
              <div className="text-sm font-medium text-gray-700 mt-1">
                {stat.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stat.description}
              </div>
            </div>

            {/* Loading indicator for scan in progress */}
            {stat.label === 'Last Scan' && stats.scan_in_progress && (
              <div className="mt-2">
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3"></div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
