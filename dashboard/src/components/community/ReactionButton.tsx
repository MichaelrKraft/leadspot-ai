'use client';

import { useState } from 'react';

interface ReactionButtonProps {
  type: 'like' | 'love' | 'celebrate' | 'insightful';
  count: number;
  onReact: () => void;
  compact?: boolean;
}

export default function ReactionButton({ type, count, onReact, compact = false }: ReactionButtonProps) {
  const [reacted, setReacted] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    setReacted(!reacted);
    onReact();
  };

  const getEmoji = () => {
    switch (type) {
      case 'like':
        return '👍';
      case 'love':
        return '❤️';
      case 'celebrate':
        return '🎉';
      case 'insightful':
        return '💡';
      default:
        return '👍';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'like':
        return 'Like';
      case 'love':
        return 'Love';
      case 'celebrate':
        return 'Celebrate';
      case 'insightful':
        return 'Insightful';
      default:
        return 'Like';
    }
  };

  const getActiveColor = () => {
    switch (type) {
      case 'like':
        return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30';
      case 'love':
        return 'bg-accent-red/10 text-accent-red border-accent-red/30';
      case 'celebrate':
        return 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      case 'insightful':
        return 'bg-accent-purple/10 text-accent-purple border-accent-purple/30';
      default:
        return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30';
    }
  };

  const baseClasses = compact
    ? 'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all duration-200'
    : 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200';

  const inactiveClasses = 'bg-bg-tertiary text-text-muted border border-transparent hover:border-border-hover hover:text-text-primary';
  const activeClasses = `border ${getActiveColor()}`;

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`${baseClasses} ${reacted ? activeClasses : inactiveClasses} group`}
        aria-label={`${getLabel()} - ${count} reactions`}
      >
        {/* Emoji */}
        <span className={`${compact ? 'text-sm' : 'text-base'} transition-transform group-hover:scale-110`}>
          {getEmoji()}
        </span>

        {/* Count */}
        {count > 0 && (
          <span className="font-medium">
            {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
          </span>
        )}

        {/* Label (only in non-compact mode when count is 0) */}
        {!compact && count === 0 && (
          <span className="font-medium">{getLabel()}</span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-text-primary text-bg-primary text-xs rounded-lg whitespace-nowrap pointer-events-none z-10">
          {getLabel()}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-text-primary"></div>
        </div>
      )}
    </div>
  );
}
