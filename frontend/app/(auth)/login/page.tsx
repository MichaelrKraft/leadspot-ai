'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { useAuthStore } from '@/stores/useAuthStore';
import { loginWithGoogle, loginWithMicrosoft } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (email: string, password: string, _rememberMe: boolean) => {
    setError(undefined);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  const handleMicrosoftLogin = () => {
    loginWithMicrosoft();
  };

  const handleDemoLogin = () => {
    // Write to localStorage directly so AuthGuard picks it up immediately
    const demoState = {
      state: {
        user: {
          id: 'demo-user',
          email: 'demo@leadspot.ai',
          name: 'Demo User',
          organization: 'LeadSpot Demo',
          role: 'admin',
        },
        token: 'demo-token',
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem('auth-storage', JSON.stringify(demoState));

    // Full page navigation to ensure AuthGuard re-reads localStorage
    window.location.href = '/dashboard';
  };

  return (
    <LoginForm
      onSubmit={handleLogin}
      onGoogleLogin={handleGoogleLogin}
      onMicrosoftLogin={handleMicrosoftLogin}
      onDemoLogin={handleDemoLogin}
      error={error}
      loading={loading}
    />
  );
}
