'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RegisterForm from '@/components/auth/RegisterForm';
import { useAuthStore } from '@/stores/useAuthStore';
import { loginWithGoogle, loginWithMicrosoft } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthStore();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (data: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
  }) => {
    setError(undefined);
    setLoading(true);

    try {
      await register(data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
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

  return (
    <RegisterForm
      onSubmit={handleRegister}
      onGoogleLogin={handleGoogleLogin}
      onMicrosoftLogin={handleMicrosoftLogin}
      error={error}
      loading={loading}
    />
  );
}
