/**
 * Authentication module for InnoSynth.ai
 *
 * Uses secure httpOnly cookies for token storage.
 * CSRF token is required for state-changing requests.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  organization_domain?: string;
}

export interface User {
  user_id: string;
  name: string;
  email: string;
  organization_id?: string;
  role: string;
  created_at?: string;
  last_login?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// RefreshTokenResponse is the same as AuthResponse
export type RefreshTokenResponse = AuthResponse;

/**
 * Get CSRF token from cookie
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Login with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for httpOnly cookies
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || 'Login failed');
  }

  const data = await response.json();

  // Store user data locally (token is in httpOnly cookie)
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}

/**
 * Register a new user
 */
export async function register(userData: RegisterData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for httpOnly cookies
    body: JSON.stringify({
      email: userData.email,
      name: userData.name,
      password: userData.password,
      organization_domain: userData.organization_domain || userData.email.split('@')[1],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || 'Registration failed');
  }

  const data = await response.json();

  // Store user data locally (token is in httpOnly cookie)
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // Required for httpOnly cookies
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage regardless of API call success
    localStorage.removeItem('user');
  }
}

/**
 * Refresh the authentication token using cookie-based refresh
 */
export async function refreshToken(): Promise<RefreshTokenResponse> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // Refresh token is in httpOnly cookie
  });

  if (!response.ok) {
    // If refresh fails, clear user data
    localStorage.removeItem('user');
    throw new Error('Token refresh failed');
  }

  const data = await response.json();

  // Update stored user data
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}

/**
 * Validate current session by checking with server
 */
export async function validateSession(): Promise<User | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include', // Required for httpOnly cookies
    });

    if (!response.ok) {
      localStorage.removeItem('user');
      return null;
    }

    const user = await response.json();
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * Google OAuth login
 * Gets authorization URL from backend and redirects to Google consent
 */
export async function loginWithGoogle(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/auth/oauth/google/authorize`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to get Google authorization URL');
    }

    const data = await response.json();
    window.location.href = data.authorization_url;
  } catch (error) {
    console.error('Google OAuth error:', error);
    const message = error instanceof Error ? error.message : 'Google login is not configured';
    alert(message + '. Please contact your administrator.');
  }
}

/**
 * Microsoft OAuth login
 * Gets authorization URL from backend and redirects to Microsoft consent
 */
export async function loginWithMicrosoft(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/auth/oauth/microsoft/authorize`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to get Microsoft authorization URL');
    }

    const data = await response.json();
    window.location.href = data.authorization_url;
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    const message = error instanceof Error ? error.message : 'Microsoft login is not configured';
    alert(message + '. Please contact your administrator.');
  }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(code: string, provider: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/oauth/${provider}/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'OAuth authentication failed');
  }

  const data = await response.json();

  // Store user data locally (token is in httpOnly cookie)
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}

/**
 * Request password reset
 * Note: Not implemented yet (Week 5)
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Password reset request failed');
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || 'Password reset failed');
  }
}

/**
 * Verify if a reset token is valid
 */
export async function verifyResetToken(token: string): Promise<{ valid: boolean; message: string }> {
  const response = await fetch(`${API_URL}/auth/verify-reset-token/${token}`, {
    method: 'GET',
  });

  if (!response.ok) {
    return { valid: false, message: 'Token verification failed' };
  }

  return response.json();
}

/**
 * Check if user is authenticated (quick check based on local storage)
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('user');
}

/**
 * Get current user from local storage
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;

  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Get auth token - deprecated, tokens are now in httpOnly cookies
 * @deprecated Use cookie-based auth instead
 */
export function getAuthToken(): string | null {
  console.warn('getAuthToken() is deprecated. Tokens are now stored in httpOnly cookies.');
  return null;
}
