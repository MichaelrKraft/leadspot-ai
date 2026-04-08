'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/stores/useAuthStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import ThemeToggle from '@/components/ThemeToggle';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  dividerAfter?: boolean;
  external?: boolean;
}

const navigation: NavItem[] = [
  {
    name: 'AI Command Center',
    href: '/command-center',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
      </svg>
    ),
    dividerAfter: true,
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    name: 'Contacts',
    href: '/contacts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 5.5A3.5 3.5 0 0 1 15.5 9a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 8.5 9 3.5 3.5 0 0 1 12 5.5M5 8c.56 0 1.08.15 1.53.42-.15 1.43.27 2.85 1.13 3.96C7.16 13.34 6.16 14 5 14a3 3 0 0 1-3-3 3 3 0 0 1 3-3m14 0a3 3 0 0 1 3 3 3 3 0 0 1-3 3c-1.16 0-2.16-.66-2.66-1.62a5.54 5.54 0 0 0 1.13-3.96c.45-.27.97-.42 1.53-.42M5.5 18.25c0-2.07 2.91-3.75 6.5-3.75s6.5 1.68 6.5 3.75V20h-13v-1.75M0 20v-1.5c0-1.39 1.89-2.56 4.45-2.9-.59.68-.95 1.62-.95 2.65V20H0m24 0h-3.5v-1.75c0-1.03-.36-1.97-.95-2.65 2.56.34 4.45 1.51 4.45 2.9V20z" />
      </svg>
    ),
  },
  {
    name: 'Smart Lists',
    href: '/smart-lists',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 18h5v-6h-5v6zm-6 0h5V5H4v13zm12 0h5v-6h-5v6zM10 5v6h11V5H10z" />
      </svg>
    ),
  },
  {
    name: 'Deals',
    href: '/deals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
      </svg>
    ),
  },
  {
    name: 'Segments',
    href: '/segments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  },
  {
    name: 'Campaigns',
    href: '/campaigns',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
      </svg>
    ),
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
      </svg>
    ),
  },
  {
    name: 'Emails',
    href: '/emails',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
    ),
  },
  {
    name: 'Inbox',
    href: '/inbox',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z"/>
      </svg>
    ),
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
      </svg>
    ),
    dividerAfter: true,
  },
  {
    name: 'Timeline',
    href: '/timeline',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
      </svg>
    ),
  },
  {
    name: 'Decisions',
    href: '/decisions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7M9 21v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1m3-17a5 5 0 0 0-5 5c0 2.05 1.23 3.81 3 4.58V16h4v-2.42c1.77-.77 3-2.53 3-4.58a5 5 0 0 0-5-5z" />
      </svg>
    ),
  },
  {
    name: 'Voice Agents',
    href: '/voice-agents',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93V7h2v1c0 2.76 2.24 5 5 5s5-2.24 5-5V7h2v1c0 4.08-3.06 7.44-7 7.93V19h3v2H9v-2h3v-3.07z" />
      </svg>
    ),
  },
  {
    name: 'Community',
    href: '/community',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
    dividerAfter: true,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
  },
];

const pageTitles: Record<string, string> = {
  '/command-center': 'AI Command Center',
  '/dashboard': 'Dashboard',
  '/contacts': 'Contacts',
  '/smart-lists': 'Smart Lists',
  '/deals': 'Deals',
  '/segments': 'Segments',
  '/campaigns': 'Campaigns',
  '/calendar': 'Calendar',
  '/emails': 'Emails',
  '/inbox': 'Inbox',
  '/reports': 'Reports',
  '/timeline': 'Timeline',
  '/decisions': 'Decisions',
  '/voice-agents': 'Voice Agents',
  '/community': 'Community',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname?.startsWith(path + '/')) {
      return title;
    }
  }
  return 'Dashboard';
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-slate-200 bg-[#f8fafc] dark:border-white/10 dark:bg-[#1e2639]">
          {/* Logo */}
          <div className="flex items-center justify-center border-b border-slate-200 px-3 py-4 dark:border-white/10">
            <Link href="/dashboard">
              {/* Light theme logo */}
              <Image
                src="/leadspot-logo.png"
                alt="LeadSpot.ai"
                width={180}
                height={62}
                className="h-[62px] w-auto dark:hidden"
                priority
              />
              {/* Dark theme logo */}
              <Image
                src="/leadspot-logo-light.png"
                alt="LeadSpot.ai"
                width={180}
                height={62}
                className="hidden h-[62px] w-auto dark:block"
                priority
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3">
            {navigation.map((item, index) => {
              const isActive =
                !item.external &&
                (pathname === item.href || pathname?.startsWith(item.href + '/'));

              const linkProps = item.external
                ? { target: '_blank' as const, rel: 'noopener noreferrer' }
                : {};

              const LinkOrAnchor = item.external ? 'a' : Link;

              return (
                <div key={item.name}>
                  <LinkOrAnchor
                    href={item.href}
                    {...linkProps}
                    className={`flex items-center gap-3 px-5 py-3 text-sm transition-all ${
                      isActive
                        ? 'ls-nav-active border-l-[3px] border-l-primary-400 text-indigo-600 dark:text-primary-200'
                        : 'border-l-[3px] border-l-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                    {item.external && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="ml-auto opacity-40"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    )}
                  </LinkOrAnchor>
                  {item.dividerAfter && (
                    <div className="mx-5 my-3 h-px bg-slate-200 dark:bg-white/10" />
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="ml-[220px] flex flex-1 flex-col min-h-0">
          {/* Header Bar */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-6 py-4 dark:border-white/10 dark:bg-[#111118]">
            <h1 className="m-0 text-xl font-semibold text-slate-800 dark:text-white">
              {getPageTitle(pathname)}
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {user?.name || user?.email || ''}
              </span>
              <ThemeToggle compact />
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0a0a0d]">
            <ErrorBoundary>
              <div className="relative z-10">{children}</div>
            </ErrorBoundary>
          </main>

          {/* Status Bar */}
          <footer className="flex items-center justify-center gap-5 border-t border-slate-200 bg-[#f8fafc] px-6 py-3 text-xs dark:border-white/10 dark:bg-background-secondary">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span>Connected</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span>API: Connected</span>
            </div>
          </footer>
        </div>
      </div>
    </AuthGuard>
  );
}
