'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/stores/useAuthStore';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Decisions', href: '/decisions' },
    { name: 'Query', href: '/query' },
    { name: 'Documents', href: '/documents' },
    { name: 'Health', href: '/health' },
    { name: 'Sources', href: '/sources' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-[#0A0F1C]">
        {/* Background gradients */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/5"></div>
          <div className="absolute -right-1/4 bottom-0 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-500/5"></div>
        </div>

        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-white/5">
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="border-b border-gray-200 p-6 dark:border-white/10">
              <Link href="/dashboard" className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  LeadSpot<span className="text-blue-500">.ai</span>
                </h1>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center rounded-lg px-4 py-3 transition-colors ${
                      isActive
                        ? 'border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="border-t border-gray-200 p-4 dark:border-white/10">
              <div className="mb-2 flex items-center gap-3 rounded-lg bg-gray-100 px-4 py-3 dark:bg-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 font-bold text-blue-600 dark:text-blue-400">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {user?.name || 'User'}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/5 dark:hover:text-red-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 min-h-screen">
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
