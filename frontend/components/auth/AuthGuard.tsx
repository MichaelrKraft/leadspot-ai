'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

// Auto-login in development mode with real backend authentication
const AUTO_LOGIN_IN_DEV = process.env.NODE_ENV === 'development';

// Test credentials for development auto-login
const DEV_CREDENTIALS = {
  email: 'test@example.com',
  password: 'password123',
};

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, login } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);
  const devLoginAttempted = useRef(false);

  // Check localStorage directly on mount to handle zustand hydration timing
  useEffect(() => {
    const checkAuth = async () => {
      // First check if already authenticated
      try {
        const authStorage = localStorage.getItem('auth-storage');
        console.log('[AuthGuard] Checking auth storage:', authStorage ? 'found' : 'not found');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          console.log('[AuthGuard] Auth state:', {
            isAuthenticated: parsed?.state?.isAuthenticated,
            hasToken: !!parsed?.state?.token
          });
          if (parsed?.state?.isAuthenticated) {
            setHasAuth(true);
            setIsHydrated(true);
            return;
          }
        }
      } catch {
        // Ignore parse errors
      }

      // In development, auto-login with real backend credentials
      if (AUTO_LOGIN_IN_DEV && !devLoginAttempted.current) {
        devLoginAttempted.current = true;
        try {
          await login(DEV_CREDENTIALS.email, DEV_CREDENTIALS.password);
          setHasAuth(true);
        } catch (error) {
          console.error('Dev auto-login failed:', error);
          // Still mark as hydrated so the redirect logic can kick in
        }
      }

      setIsHydrated(true);
    };
    checkAuth();
  }, [login]);

  useEffect(() => {
    // In development, we auto-login so only redirect if auth actually failed
    // In production, redirect to login if not authenticated
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
