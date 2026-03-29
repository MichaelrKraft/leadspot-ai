'use client';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
  gradient: 'cyan' | 'purple' | 'green';
}

const gradientClasses = {
  cyan: 'stat-gradient-cyan border-accent-cyan/20',
  purple: 'stat-gradient-purple border-accent-purple/20',
  green: 'stat-gradient-green border-accent-green/20',
};

const iconColors = {
  cyan: 'text-accent-cyan',
  purple: 'text-accent-purple',
  green: 'text-accent-green',
};

export default function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  gradient,
}: StatCardProps) {
  return (
    <div
      className={`p-6 rounded-xl border ${gradientClasses[gradient]} bg-bg-secondary card-hover`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-secondary text-sm font-medium">{title}</p>
          <p className="text-3xl font-semibold text-text-primary mt-2">{value}</p>
          {change && (
            <p
              className={`text-sm mt-2 ${
                changeType === 'positive'
                  ? 'text-accent-green'
                  : changeType === 'negative'
                  ? 'text-accent-red'
                  : 'text-text-muted'
              }`}
            >
              {change}
            </p>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-lg bg-bg-tertiary flex items-center justify-center ${iconColors[gradient]}`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d={icon}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
