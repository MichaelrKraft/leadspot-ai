'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword, verifyResetToken } from '@/lib/auth';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string>();
  const [validationErrors, setValidationErrors] = useState<{ password?: string; confirm?: string }>(
    {}
  );
  const [success, setSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setVerifying(false);
        return;
      }

      try {
        const result = await verifyResetToken(token);
        setTokenValid(result.valid);
      } catch {
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    }

    checkToken();
  }, [token]);

  const validateForm = (): boolean => {
    const errors: { password?: string; confirm?: string } = {};

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(password)) {
      errors.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(password)) {
      errors.password = 'Password must contain at least one number';
    }

    if (!confirmPassword) {
      errors.confirm = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirm = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !token) return;

    setError(undefined);
    setLoading(true);

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while verifying token
  if (verifying) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-gray-400">Verifying your reset link...</p>
      </div>
    );
  }

  // No token provided
  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Invalid Reset Link</h2>
        <p className="mb-6 text-gray-400">
          This password reset link is invalid. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  // Token is invalid or expired
  if (!tokenValid) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
          <svg
            className="h-8 w-8 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Link Expired</h2>
        <p className="mb-6 text-gray-400">
          This password reset link has expired or has already been used. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <svg
            className="h-8 w-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Password Reset Successfully</h2>
        <p className="mb-6 text-gray-400">
          Your password has been updated. You can now log in with your new password.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  // Reset form
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-white">Reset Your Password</h2>
        <p className="text-sm text-gray-400">Enter your new password below.</p>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-300">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (validationErrors.password) {
                setValidationErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter new password"
            disabled={loading}
            aria-invalid={!!validationErrors.password}
            aria-describedby={validationErrors.password ? 'password-error' : undefined}
          />
          {validationErrors.password && (
            <p id="password-error" className="mt-1 text-sm text-red-400">
              {validationErrors.password}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-300">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (validationErrors.confirm) {
                setValidationErrors((prev) => ({ ...prev, confirm: undefined }));
              }
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm new password"
            disabled={loading}
            aria-invalid={!!validationErrors.confirm}
            aria-describedby={validationErrors.confirm ? 'confirm-error' : undefined}
          />
          {validationErrors.confirm && (
            <p id="confirm-error" className="mt-1 text-sm text-red-400">
              {validationErrors.confirm}
            </p>
          )}
        </div>

        {/* Password requirements hint */}
        <div className="rounded-lg bg-white/5 p-3 text-xs text-gray-400">
          <p className="mb-1 font-medium text-gray-300">Password requirements:</p>
          <ul className="space-y-0.5">
            <li className={password.length >= 8 ? 'text-green-400' : ''}>
              • At least 8 characters
            </li>
            <li className={/[A-Z]/.test(password) ? 'text-green-400' : ''}>
              • One uppercase letter
            </li>
            <li className={/[a-z]/.test(password) ? 'text-green-400' : ''}>
              • One lowercase letter
            </li>
            <li className={/[0-9]/.test(password) ? 'text-green-400' : ''}>• One number</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Resetting Password...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
