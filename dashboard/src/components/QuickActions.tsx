'use client';

const actions = [
  {
    name: 'New Campaign',
    description: 'Create email or SMS campaign',
    icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
    color: 'cyan',
  },
  {
    name: 'Import Contacts',
    description: 'Upload CSV or sync from CRM',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    color: 'purple',
  },
  {
    name: 'Build Segment',
    description: 'Create targeted audience',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'green',
  },
  {
    name: 'Send Email',
    description: 'Quick one-off email',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    color: 'cyan',
  },
];

const colorClasses = {
  cyan: 'hover:border-accent-cyan hover:shadow-glow-cyan text-accent-cyan',
  purple: 'hover:border-accent-purple hover:shadow-glow-purple text-accent-purple',
  green: 'hover:border-accent-green text-accent-green',
};

export default function QuickActions() {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.name}
            className={`p-4 rounded-lg border border-border-subtle bg-bg-tertiary transition-all duration-200 text-left ${colorClasses[action.color as keyof typeof colorClasses]}`}
          >
            <svg
              className="w-6 h-6 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d={action.icon}
              />
            </svg>
            <p className="font-medium text-text-primary text-sm">{action.name}</p>
            <p className="text-xs text-text-muted mt-1">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
