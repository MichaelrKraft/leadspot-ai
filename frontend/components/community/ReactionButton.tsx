'use client';

interface ReactionButtonProps {
  type: string;
  count: number;
  reacted: boolean;
  onToggle: (reactionType: string) => void;
  compact?: boolean;
}

const EMOJI_MAP: Record<string, string> = {
  like: '\uD83D\uDC4D',
  love: '\u2764\uFE0F',
  celebrate: '\uD83C\uDF89',
  insightful: '\uD83D\uDCA1',
};

const LABEL_MAP: Record<string, string> = {
  like: 'Like',
  love: 'Love',
  celebrate: 'Celebrate',
  insightful: 'Insightful',
};

function getActiveColor(type: string): string {
  switch (type) {
    case 'like':
      return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    case 'love':
      return 'bg-rose-50 text-rose-600 border-rose-200';
    case 'celebrate':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'insightful':
      return 'bg-violet-50 text-violet-600 border-violet-200';
    default:
      return 'bg-indigo-50 text-indigo-600 border-indigo-200';
  }
}

export default function ReactionButton({
  type,
  count,
  reacted,
  onToggle,
  compact = false,
}: ReactionButtonProps) {
  const emoji = EMOJI_MAP[type] || '\uD83D\uDC4D';
  const label = LABEL_MAP[type] || 'Like';

  const sizeClasses = compact
    ? 'gap-1 px-2 py-1 text-xs'
    : 'gap-1.5 px-3 py-1.5 text-sm';

  const inactiveClasses =
    'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700';
  const activeClasses = `border ${getActiveColor(type)}`;

  return (
    <button
      onClick={() => onToggle(type)}
      className={`inline-flex items-center rounded-lg font-medium transition-all duration-150 ${sizeClasses} ${
        reacted ? activeClasses : inactiveClasses
      }`}
      aria-label={`${label} - ${count} reactions`}
      title={label}
    >
      <span
        className={`${compact ? 'text-sm' : 'text-base'} transition-transform hover:scale-110`}
      >
        {emoji}
      </span>
      {count > 0 && (
        <span className="font-medium">
          {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}
    </button>
  );
}
