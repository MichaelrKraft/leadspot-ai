'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface LeaderboardUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  role: string;
}

interface LeaderboardEntry {
  rank: number;
  user: LeaderboardUser | null;
  points: number;
}

interface LeaderboardProps {
  communityId?: string;
  currentUserId?: string;
  className?: string;
}

export default function Leaderboard({
  communityId,
  currentUserId,
  className = '',
}: LeaderboardProps) {
  const [period, setPeriod] = useState<'all-time' | 'month' | 'week'>('all-time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, communityId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        period,
        limit: '10',
      });

      if (communityId) {
        params.append('communityId', communityId);
      }

      const response = await fetch(`/api/leaderboard?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const formatPoints = (points: number): string => {
    if (points >= 1000000) {
      return `${(points / 1000000).toFixed(1)}M`;
    }
    if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}K`;
    }
    return points.toString();
  };

  return (
    <div className={`bg-bg-secondary border border-[#2a2a2a] rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <h2 className="text-2xl font-semibold text-white mb-4">🏆 Leaderboard</h2>

        {/* Period Filter */}
        <div className="flex gap-2">
          {(['all-time', 'month', 'week'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                period === p
                  ? 'bg-[#00D9FF] text-black'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-[#1a1a1a] hover:text-white'
              }`}
            >
              {p === 'all-time' ? 'All Time' : p === 'month' ? 'This Month' : 'This Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="p-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-12 h-12 bg-bg-tertiary rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-bg-tertiary rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-bg-tertiary rounded w-1/4"></div>
                </div>
                <div className="h-6 bg-bg-tertiary rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="mt-4 px-4 py-2 bg-[#00D9FF] text-black rounded-lg font-medium hover:bg-[#00c0e6] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No leaderboard data yet. Start earning points!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => {
              const isCurrentUser = entry.user?.id === currentUserId;

              return (
                <div
                  key={entry.user?.id || entry.rank}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                    isCurrentUser
                      ? 'bg-[#00D9FF]/10 border border-[#00D9FF]/30 ring-1 ring-[#00D9FF]/20'
                      : 'bg-bg-tertiary hover:bg-[#1a1a1a]'
                  }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className="text-2xl font-bold">
                      {getRankIcon(entry.rank)}
                    </span>
                  </div>

                  {/* User Avatar */}
                  <div className="flex-shrink-0">
                    {entry.user?.avatar ? (
                      <Image
                        src={entry.user.avatar}
                        alt={entry.user.name || 'User'}
                        width={48}
                        height={48}
                        className="rounded-full border-2 border-[#2a2a2a]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#a855f7] flex items-center justify-center text-white font-bold text-lg">
                        {entry.user?.name?.[0]?.toUpperCase() || entry.user?.email?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white truncate">
                        {entry.user?.name || entry.user?.email || 'Unknown User'}
                      </p>
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 bg-[#00D9FF]/20 text-[#00D9FF] text-xs font-medium rounded">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      Rank #{entry.rank}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-2xl font-bold text-[#00D9FF]">
                      {formatPoints(entry.points)}
                    </p>
                    <p className="text-xs text-text-secondary">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
