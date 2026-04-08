'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Profile', href: '/settings' },
  { label: 'Integrations', href: '/settings/integrations' },
  { label: 'Billing', href: '/settings/billing' },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-white/10 mb-8">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-white/30'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
