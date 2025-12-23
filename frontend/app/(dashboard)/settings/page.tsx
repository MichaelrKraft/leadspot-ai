'use client';

import Link from 'next/link';

export default function SettingsPage() {
  const settingsSections = [
    {
      name: 'Integrations',
      description: 'Connect Google Drive, Slack, and other platforms',
      href: '/settings/integrations',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      color: 'blue',
    },
    {
      name: 'API Keys',
      description: 'Manage API keys for programmatic access',
      href: '/settings/api-keys',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
      color: 'purple',
      comingSoon: true,
    },
    {
      name: 'Notifications',
      description: 'Configure email and in-app notifications',
      href: '/settings/notifications',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      color: 'yellow',
      comingSoon: true,
    },
    {
      name: 'Team Members',
      description: 'Invite and manage team access',
      href: '/settings/team',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'green',
      comingSoon: true,
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:bg-purple-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 group-hover:bg-yellow-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20 group-hover:bg-green-500/20',
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">
          Manage your organization settings and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => (
          <Link
            key={section.name}
            href={section.comingSoon ? '#' : section.href}
            className={`group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all ${
              section.comingSoon ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {section.comingSoon && (
              <span className="absolute top-4 right-4 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                Coming Soon
              </span>
            )}
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl border transition-colors ${colorClasses[section.color as keyof typeof colorClasses]}`}>
                {section.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{section.name}</h3>
                <p className="text-sm text-gray-400">{section.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
