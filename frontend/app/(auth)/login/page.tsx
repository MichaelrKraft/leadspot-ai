'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { useAuthStore } from '@/stores/useAuthStore';
import { loginWithGoogle, loginWithMicrosoft } from '@/lib/auth';
import { api } from '@/lib/api';

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

  // Demo access is only offered when the backend enables it (NEXT_PUBLIC flag
  // mirrors the server's DEMO_LOGIN_ENABLED). Otherwise the button is hidden
  // rather than left as a no-op.
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === 'true';

  const handleDemoLogin = async () => {
    setError(undefined);
    setLoading(true);
    try {
      // Real backend session: sets the httpOnly cookie so middleware/AuthGuard
      // treat it as a genuine login (the old localStorage-only shim was
      // immediately bounced by middleware in production).
      const res = await api.auth.demoLogin();
      const u = res.data.user;
      useAuthStore.getState().setUser({
        id: u.user_id,
        email: u.email,
        name: u.name,
        organizationId: u.organization_id,
        role: u.role,
      });
      router.push('/dashboard');
    } catch {
      setError('Demo is not available right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginForm
      onSubmit={handleLogin}
      onGoogleLogin={handleGoogleLogin}
      onMicrosoftLogin={handleMicrosoftLogin}
      onDemoLogin={demoEnabled ? handleDemoLogin : undefined}
      error={error}
      loading={loading}
    />
  );
}
