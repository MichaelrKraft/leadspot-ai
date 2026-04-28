'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileNavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const SPACE_AGENT_ENABLED = process.env.NEXT_PUBLIC_SPACE_AGENT_ENABLED === 'true';

const HomeIcon = (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12 12 3l9 9" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const ContactsIcon = (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);

const WorkspaceIcon = (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const DealsIcon = (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 4 4 5-6" />
  </svg>
);

const MoreIcon = (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    <circle cx="7" cy="12" r="1.25" fill="currentColor" />
    <circle cx="17" cy="12" r="1.25" fill="currentColor" />
  </svg>
);

function buildItems(): MobileNavItem[] {
  const items: MobileNavItem[] = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon },
    { name: 'Contacts', href: '/contacts', icon: ContactsIcon },
  ];

  if (SPACE_AGENT_ENABLED) {
    items.push({ name: 'Workspace', href: '/workspace', icon: WorkspaceIcon });
    items.push({ name: 'Deals', href: '/deals', icon: DealsIcon });
  } else {
    items.push({ name: 'Deals', href: '/deals', icon: DealsIcon });
  }

  items.push({ name: 'More', href: '/settings', icon: MoreIcon });
  return items;
}

export default function MobileNav() {
  const pathname = usePathname();
  const items = buildItems();

  const isActive = (href: string): boolean => {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t border-zinc-800 bg-[#0a0a0d]/95 backdrop-blur-md md:hidden"
    >
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.name}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              active ? 'text-indigo-400' : 'text-zinc-500'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
