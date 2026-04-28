import { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Public-facing layout for legal/marketing pages.
 *
 * Renders without auth checks — anyone can read /privacy, /dpa, /security
 * without being signed in. Designed mobile-first; container caps at ~720px
 * for legal-doc readability.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <header className="border-b border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            LeadSpot<span className="text-blue-500">.ai</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">
              Privacy
            </Link>
            <Link href="/dpa" className="hidden hover:text-gray-900 sm:inline dark:hover:text-white">
              DPA
            </Link>
            <Link href="/security" className="hidden hover:text-gray-900 sm:inline dark:hover:text-white">
              Security
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>

      <footer className="mt-16 border-t border-gray-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-4 text-center text-xs text-gray-500 sm:px-6">
          <p className="mb-1">© 2026 LeadSpot.ai. All rights reserved.</p>
          <p>
            Questions?{' '}
            <a href="mailto:support@leadspot.ai" className="text-blue-500 hover:underline">
              support@leadspot.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
