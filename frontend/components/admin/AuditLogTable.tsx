'use client';

import { useState } from 'react';
import { AuditLog, AuditAction } from '@/types/admin';
import { ChevronDown, ChevronUp, User, FileText, Search, Settings } from 'lucide-react';

interface AuditLogTableProps {
  logs: AuditLog[];
}

const getActionIcon = (action: AuditAction) => {
  if (action.startsWith('user.')) return User;
  if (action.startsWith('document.')) return FileText;
  if (action.startsWith('query.')) return Search;
  return Settings;
};

const getActionColor = (action: AuditAction) => {
  if (action.includes('deleted')) return 'text-red-600';
  if (action.includes('created') || action.includes('uploaded')) return 'text-green-600';
  if (action.includes('updated')) return 'text-blue-600';
  return 'text-gray-600';
};

const formatAction = (action: AuditAction) => {
  return action
    .split('.')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function AuditLogTable({ logs }: AuditLogTableProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const toggleExpand = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">
              Action
            </th>
            <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">
              User
            </th>
            <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">
              Timestamp
            </th>
            <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">
              IP Address
            </th>
            <th className="text-right py-3 px-4 font-medium text-sm text-gray-700">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const Icon = getActionIcon(log.action);
            const isExpanded = expandedLog === log.id;
            const { date, time } = formatTimestamp(log.timestamp);
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

            return (
              <>
                <tr
                  key={log.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`w-4 h-4 ${getActionColor(log.action)}`}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {formatAction(log.action)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {log.userName}
                      </div>
                      <div className="text-xs text-gray-500">{log.userEmail}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="text-sm text-gray-900">{date}</div>
                      <div className="text-xs text-gray-500">{time}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 font-mono">
                      {log.ipAddress || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasMetadata && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <>
                            Hide <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Show <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>

                {isExpanded && hasMetadata && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="py-4 px-4">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                          Event Details
                        </h4>
                        <dl className="grid grid-cols-2 gap-3">
                          {Object.entries(log.metadata!).map(([key, value]) => (
                            <div key={key}>
                              <dt className="text-xs font-medium text-gray-500 uppercase">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </dt>
                              <dd className="text-sm text-gray-900 mt-1">
                                {typeof value === 'object'
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>

      {logs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No audit logs found</p>
        </div>
      )}
    </div>
  );
}
