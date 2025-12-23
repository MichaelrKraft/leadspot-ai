// Health Score Display Component

'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface HealthScoreProps {
  score: number; // 0-100
  trend: number; // Percentage change
  lastUpdated?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export default function HealthScore({
  score,
  trend,
  lastUpdated,
  size = 'lg'
}: HealthScoreProps) {
  // Determine color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGaugeColor = (score: number): string => {
    if (score >= 80) return 'stroke-green-500';
    if (score >= 60) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  // Calculate gauge dimensions based on size
  const dimensions = {
    sm: { size: 120, stroke: 8, fontSize: 'text-2xl' },
    md: { size: 180, stroke: 12, fontSize: 'text-4xl' },
    lg: { size: 240, stroke: 16, fontSize: 'text-6xl' }
  };

  const { size: svgSize, stroke: strokeWidth, fontSize } = dimensions[size];
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Format last updated time
  const formatTime = (time: string | null) => {
    if (!time) return 'Never';
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Circular Gauge */}
      <div className="relative">
        <svg width={svgSize} height={svgSize} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            className={getGaugeColor(score)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out'
            }}
          />
        </svg>

        {/* Score in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={clsx('font-bold', getScoreColor(score), fontSize)}>
            {Math.round(score)}
          </div>
          <div className="text-sm text-gray-500">Health Score</div>
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center gap-2">
        {trend > 0 ? (
          <>
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              +{trend.toFixed(1)}%
            </span>
          </>
        ) : trend < 0 ? (
          <>
            <TrendingDown className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-600">
              {trend.toFixed(1)}%
            </span>
          </>
        ) : (
          <>
            <Minus className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">
              No change
            </span>
          </>
        )}
        <span className="text-xs text-gray-400">from last scan</span>
      </div>

      {/* Last Updated */}
      {lastUpdated !== undefined && (
        <div className="text-xs text-gray-400">
          Last updated: {formatTime(lastUpdated)}
        </div>
      )}
    </div>
  );
}
