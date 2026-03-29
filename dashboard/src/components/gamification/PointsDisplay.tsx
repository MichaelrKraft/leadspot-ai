'use client';

import { useState, useEffect } from 'react';

interface PointTransaction {
  id: string;
  points: number;
  reason: string;
  sourceType: string;
  createdAt: Date;
}

interface PointsData {
  total: number;
  level: number;
  levelThresholds: {
    min: number;
    max: number;
  };
  pointsInLevel: number;
  pointsForNextLevel: number;
  progressPercent: number;
}

interface PointsDisplayProps {
  userId: string;
  compact?: boolean;
  showTransactions?: boolean;
  className?: string;
}

export default function PointsDisplay({
  userId,
  compact = false,
  showTransactions = true,
  className = '',
}: PointsDisplayProps) {
  const [points, setPoints] = useState<PointsData | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchPoints = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/points?limit=5`);

      if (!response.ok) {
        throw new Error('Failed to fetch points');
      }

      const data = await response.json();
      setPoints(data.points);
      setTransactions(data.transactions);
    } catch (err) {
      console.error('Error fetching points:', err);
      setError('Failed to load points');
    } finally {
      setLoading(false);
    }
  };

  const formatPoints = (points: number): string => {
    return points.toLocaleString();
  };

  const getSourceIcon = (sourceType: string): string => {
    const icons: Record<string, string> = {
      post: '📝',
      comment: '💬',
      reaction: '❤️',
      course_completion: '🎓',
      event_attendance: '📅',
      daily_login: '🌟',
    };
    return icons[sourceType] || '⭐';
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={`bg-bg-secondary border border-[#2a2a2a] rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-bg-tertiary rounded w-1/3"></div>
          <div className="h-16 bg-bg-tertiary rounded"></div>
          <div className="h-4 bg-bg-tertiary rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error || !points) {
    return (
      <div className={`bg-bg-secondary border border-[#2a2a2a] rounded-xl p-6 ${className}`}>
        <p className="text-red-400">{error || 'Failed to load points'}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        {/* Level Badge */}
        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#a855f7] flex items-center justify-center shadow-lg shadow-[#00D9FF]/20">
          <span className="text-2xl font-bold text-white">{points.level}</span>
        </div>

        {/* Points Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-secondary">Level {points.level}</p>
          <p className="text-2xl font-bold text-[#00D9FF]">
            {formatPoints(points.total)} pts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-bg-secondary border border-[#2a2a2a] rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <h3 className="text-xl font-semibold text-white mb-4">⭐ Your Progress</h3>

        {/* Level & Points */}
        <div className="flex items-center gap-6">
          {/* Level Badge */}
          <div className="flex-shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#a855f7] flex items-center justify-center shadow-lg shadow-[#00D9FF]/20">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{points.level}</p>
              <p className="text-xs text-white/80">Level</p>
            </div>
          </div>

          {/* Points Info */}
          <div className="flex-1">
            <p className="text-4xl font-bold text-[#00D9FF] mb-1">
              {formatPoints(points.total)}
            </p>
            <p className="text-sm text-text-secondary">Total Points</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-text-secondary">
              Level {points.level}
            </span>
            <span className="text-white font-medium">
              {formatPoints(points.pointsInLevel)} / {formatPoints(points.pointsForNextLevel)}
            </span>
            <span className="text-text-secondary">
              Level {points.level + 1}
            </span>
          </div>
          <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00D9FF] to-[#a855f7] transition-all duration-500"
              style={{ width: `${points.progressPercent}%` }}
            ></div>
          </div>
          <p className="text-xs text-text-secondary mt-2 text-center">
            {formatPoints(points.pointsForNextLevel - points.pointsInLevel)} points to next level
          </p>
        </div>
      </div>

      {/* Recent Transactions */}
      {showTransactions && transactions.length > 0 && (
        <div className="p-6">
          <h4 className="text-sm font-semibold text-white mb-4">Recent Activity</h4>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center text-xl">
                  {getSourceIcon(transaction.sourceType)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {transaction.reason}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatDate(transaction.createdAt)}
                  </p>
                </div>

                {/* Points */}
                <div className="flex-shrink-0">
                  <span
                    className={`text-lg font-bold ${
                      transaction.points > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {transaction.points > 0 ? '+' : ''}
                    {transaction.points}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
