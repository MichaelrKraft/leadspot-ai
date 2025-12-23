'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';

export default function ApiKeysPage() {
  const { token } = useAuthStore();
  const [anthropicKey, setAnthropicKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Fetch current API key status on load
  useEffect(() => {
    const fetchApiKey = async () => {
      if (!token) return;

      setIsLoading(true);
      try {
        const response = await fetch('/api/settings/api-keys', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.anthropic_key_set) {
            setSavedKey('••••••••••••••••');
          }
        }
      } catch (error) {
        console.error('Failed to fetch API key status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, [token]);

  const handleSave = async () => {
    if (!anthropicKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    if (!anthropicKey.startsWith('sk-ant-')) {
      setMessage({ type: 'error', text: 'Invalid Anthropic API key format. It should start with "sk-ant-"' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ anthropic_api_key: anthropicKey }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'API key saved successfully!' });
        setSavedKey('••••••••••••••••');
        setAnthropicKey('');
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.detail || 'Failed to save API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your API key? AI agents will not work without it.')) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'API key removed successfully' });
        setSavedKey('');
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.detail || 'Failed to remove API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove API key. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">API Keys</h1>
        <p className="text-gray-400">
          Configure your API keys to power LeadSpot.ai's AI agents
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Anthropic API Key Card */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-1">Anthropic API Key</h2>
            <p className="text-sm text-gray-400">
              Your Claude API key is required to run AI agents. Get one from{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                console.anthropic.com
              </a>
            </p>
          </div>
          {savedKey && (
            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              Connected
            </span>
          )}
        </div>

        {/* Current Key Display */}
        {savedKey && (
          <div className="mb-4 p-4 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Current API Key</p>
                <p className="text-white font-mono">{savedKey}</p>
              </div>
              <button
                onClick={handleRemove}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="anthropic-key" className="block text-sm font-medium text-gray-300 mb-2">
              {savedKey ? 'Update API Key' : 'Enter API Key'}
            </label>
            <div className="relative">
              <input
                id="anthropic-key"
                type={showKey ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
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
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || !anthropicKey.trim()}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            {isSaving ? 'Saving...' : savedKey ? 'Update API Key' : 'Save API Key'}
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">About BYOK (Bring Your Own Key)</h3>
        <p className="text-gray-300 text-sm mb-4">
          LeadSpot.ai uses a BYOK model. You pay Anthropic directly for AI usage, which keeps our platform costs low and your data private.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-gray-400 mb-1">Simple query</p>
            <p className="text-white font-semibold">~$0.003</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-gray-400 mb-1">Complex task</p>
            <p className="text-white font-semibold">~$0.05-0.20</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-gray-400 mb-1">Heavy user/month</p>
            <p className="text-white font-semibold">~$50-150</p>
          </div>
        </div>
      </div>
    </div>
  );
}
