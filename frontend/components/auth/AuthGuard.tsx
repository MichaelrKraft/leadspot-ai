'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);

  // Check localStorage directly on mount to handle zustand hydration timing
  useEffect(() => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        if (parsed?.state?.isAuthenticated) {
          setHasAuth(true);
        }
      }
    } catch {
      // Ignore parse errors
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !hasAuth && !isAuthenticated) {
      router.push('/login');
    }
  }, [isHydrated, hasAuth, isAuthenticated, router]);

  // Show loading state while hydrating
  if (!isHydrated) {
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

  // Show nothing while redirecting if not authenticated
  if (!hasAuth && !isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
