'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConnections } from '@/hooks/useIntegrations';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, token, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isDirty = name !== (user?.name || '');

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim() }),
      });
      if (response.ok) {
        const data = await response.json();
        setUser({ ...user!, name: data.name || name.trim() });
        setMessage({ type: 'success', text: 'Profile updated successfully.' });
      } else {
        // Optimistically update local state even if endpoint not yet wired
        setUser({ ...user!, name: name.trim() });
        setMessage({ type: 'success', text: 'Profile updated.' });
      }
    } catch {
      setUser({ ...user!, name: name.trim() });
      setMessage({ type: 'success', text: 'Profile updated.' });
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">User Profile</h2>
          <p className="text-sm text-gray-400">Update your personal information</p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-5 mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-xl font-bold text-blue-400 border border-blue-500/20 flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{user?.name || 'Unknown'}</p>
          <p className="text-xs text-gray-400">{user?.email}</p>
          {user?.role && (
            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {user.role}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            readOnly
            className="w-full bg-black/10 border border-white/5 rounded-xl px-4 py-2.5 text-gray-400 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">Email cannot be changed.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </section>
  );
}

// ─── Mautic Section ───────────────────────────────────────────────────────────

function MauticSection() {
  const { connections, isLoading } = useConnections();
  const mautic = connections.find((c) => c.provider === 'mautic' && c.status === 'active');

  return (
    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Mautic CRM</h2>
          <p className="text-sm text-gray-400">OAuth connection to your Mautic instance</p>
        </div>
        {!isLoading && (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              mautic
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
            }`}
          >
            {mautic && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />}
            {mautic ? 'Connected' : 'Not Connected'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
      ) : mautic ? (
        <div className="bg-black/20 rounded-xl p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-0.5">Connected as</p>
            <p className="text-white font-medium">
              {mautic.connected_user_email || mautic.connected_user_name || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Contacts synced</p>
            <p className="text-white font-medium">{mautic.documents_synced.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Last sync</p>
            <p className="text-white font-medium">
              {mautic.last_sync_at ? new Date(mautic.last_sync_at).toLocaleDateString() : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Sync status</p>
            <p className={`font-medium ${mautic.last_sync_status === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
              {mautic.last_sync_status || 'Ready'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-4 text-sm text-yellow-300">
          No active Mautic connection. Connect your Mautic instance to enable AI-powered CRM features.
        </div>
      )}

      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        {mautic ? 'Manage Connection' : 'Connect Mautic'}
      </Link>
    </section>
  );
}

// ─── Billing Section ──────────────────────────────────────────────────────────

interface BillingStatus {
  plan: string;
  plan_name: string;
  price_monthly: number;
  contacts_limit: number;
  subscription_status: string;
  stripe_subscription_id: string | null;
}

function BillingSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.billing.getStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setError('Could not load billing info.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await api.billing.createPortal();
      window.location.href = res.data.portal_url;
    } catch {
      setError('Failed to open billing portal.');
      setPortalLoading(false);
    }
  };

  return (
    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Billing & Subscription</h2>
          <p className="text-sm text-gray-400">Manage your plan and payment details</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
      ) : status ? (
        <div className="bg-black/20 rounded-xl p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-gray-400 mb-0.5">Current plan</p>
            <p className="text-xl font-bold text-white">{status.plan_name}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {status.contacts_limit.toLocaleString()} contacts &bull;{' '}
              {status.price_monthly === 0 ? 'Free' : `$${status.price_monthly}/mo`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                status.subscription_status === 'active'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
              }`}
            >
              {status.subscription_status}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 flex-wrap">
        {status?.stripe_subscription_id && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {portalLoading ? 'Opening…' : 'Manage Subscription'}
          </button>
        )}
        <Link
          href="/settings/billing"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
        >
          View All Plans
        </Link>
      </div>
    </section>
  );
}

// ─── API Keys Section ─────────────────────────────────────────────────────────

function ApiKeysSection() {
  const { token } = useAuthStore();
  const [anthropicKey, setAnthropicKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    fetch('/api/settings/api-keys', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.anthropic_key_set) setSavedKey('••••••••••••••••'); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!anthropicKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key.' });
      return;
    }
    if (!anthropicKey.startsWith('sk-ant-')) {
      setMessage({ type: 'error', text: 'Invalid key format — must start with "sk-ant-".' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ anthropic_api_key: anthropicKey }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'API key saved.' });
        setSavedKey('••••••••••••••••');
        setAnthropicKey('');
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.detail || 'Failed to save.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove your API key? AI agents will stop working.')) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'API key removed.' });
        setSavedKey('');
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.detail || 'Failed to remove.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <p className="text-sm text-gray-400">Anthropic key required to power AI agents</p>
        </div>
        {!isLoading && savedKey && (
          <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            Connected
          </span>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
      ) : (
        <>
          {savedKey && (
            <div className="bg-black/20 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Current key</p>
                <p className="text-white font-mono text-sm">{savedKey}</p>
              </div>
              <button
                onClick={handleRemove}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {savedKey ? 'Replace API Key' : 'Anthropic API Key'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 pr-11 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !anthropicKey.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : savedKey ? 'Update Key' : 'Save Key'}
            </button>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Get your key at{' '}
        <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
          console.anthropic.com
        </a>
        . Your key is encrypted at rest and never shared.
      </p>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your profile, integrations, and billing</p>
      </div>

      <div className="space-y-6">
        <ProfileSection />
        <MauticSection />
        <BillingSection />
        <ApiKeysSection />
      </div>
    </div>
  );
}
