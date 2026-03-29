'use client';

import { useState } from 'react';

interface AchievementCriteria {
  description?: string;
  [key: string]: unknown;
}

interface Achievement {
  id: string;
  name: string;
  description: string | null;
  criteria: AchievementCriteria | string | null;
  pointsValue: number;
  icon: string | null;
  isEarned?: boolean;
  earnedAt?: Date | null;
}

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export default function AchievementBadge({
  achievement,
  size = 'md',
  showTooltip = true,
  className = '',
}: AchievementBadgeProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const isEarned = achievement.isEarned || false;

  const sizeClasses = {
    sm: 'w-12 h-12 text-2xl',
    md: 'w-16 h-16 text-3xl',
    lg: 'w-24 h-24 text-5xl',
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Badge */}
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all ${
          isEarned
            ? 'bg-gradient-to-br from-[#00D9FF] to-[#a855f7] shadow-lg shadow-[#00D9FF]/20 hover:shadow-[#00D9FF]/40'
            : 'bg-bg-tertiary border-2 border-dashed border-[#2a2a2a] grayscale opacity-50'
        }`}
        onMouseEnter={() => showTooltip && setTooltipVisible(true)}
        onMouseLeave={() => showTooltip && setTooltipVisible(false)}
      >
        <span className="select-none">
          {achievement.icon || (isEarned ? '🏆' : '🔒')}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && tooltipVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 pointer-events-none">
          <div className="bg-bg-primary border border-[#2a2a2a] rounded-lg p-4 shadow-2xl">
            {/* Achievement Name */}
            <div className="flex items-start gap-2 mb-2">
              <span className="text-2xl flex-shrink-0">
                {achievement.icon || (isEarned ? '🏆' : '🔒')}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white mb-1">
                  {achievement.name}
                </h4>
                {achievement.description && (
                  <p className="text-sm text-text-secondary line-clamp-2">
                    {achievement.description}
                  </p>
                )}
              </div>
            </div>

            {/* Points Value */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2a2a2a]">
              <div className="flex items-center gap-1">
                <span className="text-[#00D9FF] font-bold">
                  +{achievement.pointsValue}
                </span>
                <span className="text-xs text-text-secondary">points</span>
              </div>

              {/* Status */}
              {isEarned ? (
                <div className="text-xs text-green-400 flex items-center gap-1">
                  <span>✓</span>
                  <span>Earned {formatDate(achievement.earnedAt)}</span>
                </div>
              ) : (
                <div className="text-xs text-text-secondary flex items-center gap-1">
                  <span>🔒</span>
                  <span>Locked</span>
                </div>
              )}
            </div>

            {/* Criteria (if locked) */}
            {!isEarned && achievement.criteria && (
              <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
                <p className="text-xs text-text-secondary">
                  <span className="font-semibold">How to earn:</span>{' '}
                  {typeof achievement.criteria === 'string'
                    ? achievement.criteria
                    : achievement.criteria.description || 'Complete the required actions'}
                </p>
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="w-3 h-3 bg-bg-primary border-r border-b border-[#2a2a2a] rotate-45 absolute top-full left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
        </div>
      )}
    </div>
  );
}
