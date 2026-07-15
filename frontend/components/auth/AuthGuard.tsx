'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [status, setStatus] = useState<'checking' | 'authed' | 'unauthed'>('checking');

  // Dev mode bypass: skip auth entirely when backend is unavailable
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'development';

  // Validate the session against the backend once on mount, rather than
  // trusting persisted localStorage (which can be stale — an expired cookie
  // plus a persisted store would render the page while every fetch 401s).
  useEffect(() => {
    if (isDev) {
      setStatus('authed');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.auth.getCurrentUser();
        if (cancelled) return;
        const u = res.data;
        setUser({
          id: u.user_id,
          email: u.email,
          name: u.name,
          organizationId: u.organization_id,
          role: u.role,
        });
        setStatus('authed');
      } catch {
        if (cancelled) return;
        // Session invalid/expired — clear any stale persisted state and redirect.
        setUser(null);
        setStatus('unauthed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDev, setUser]);

  useEffect(() => {
    if (status === 'unauthed') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'checking') {
    return (
      fallback || (
        <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Verifying authentication...</p>
          </div>
        </div>
      )
    );
  }

  if (status === 'unauthed') {
    return null;
  }

  return <>{children}</>;
}
