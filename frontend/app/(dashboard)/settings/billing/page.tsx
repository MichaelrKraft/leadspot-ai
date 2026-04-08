'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import SettingsNav from '@/components/settings/SettingsNav';

interface Plan {
  id: string;
  name: string;
  price: number;
  contacts: number;
  description: string;
  stripe_price_id: string | null;
}

interface BillingStatus {
  plan: string;
  plan_name: string;
  price_monthly: number;
  contacts_limit: number;
  description: string;
  subscription_status: string;
  stripe_subscription_id: string | null;
  available_plans: Plan[];
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Subscription updated successfully! Your plan is now active.');
    } else if (searchParams.get('canceled') === 'true') {
      setError('Checkout canceled. No changes were made.');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  async function fetchBillingStatus() {
    try {
      setLoading(true);
      const response = await api.billing.getStatus();
      setStatus(response.data);
    } catch {
      setError('Failed to load billing information.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: 'pro' | 'business') {
    try {
      setUpgrading(plan);
      setError(null);
      const response = await api.billing.createCheckout(plan);
      window.location.href = response.data.checkout_url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout. Please try again.';
      setError(message);
      setUpgrading(null);
    }
  }

  async function handleManageSubscription() {
    try {
      setPortalLoading(true);
      setError(null);
      const response = await api.billing.createPortal();
      window.location.href = response.data.portal_url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open customer portal.';
      setError(message);
      setPortalLoading(false);
    }
  }

  const planFeatures: Record<string, string[]> = {
    free: ['100 contacts', '1 user', 'Basic CRM access', 'Community support'],
    pro: ['5,000 contacts', 'Up to 5 users', 'AI insights', 'Lead scoring', 'Email support'],
    business: ['25,000 contacts', 'Up to 25 users', 'AI insights', 'Lead scoring', 'Voice input', 'White-label branding', 'Priority support'],
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Manage your profile, integrations, and billing</p>
        </div>
        <SettingsNav />
        <div className="flex items-center justify-center min-h-64">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your profile, integrations, and billing</p>
      </div>

      <SettingsNav />

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-1">Billing & Plans</h2>
        <p className="text-gray-400">Manage your subscription and billing details</p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Current Plan Summary */}
      {status && (
        <div className="mb-8 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Current Plan</p>
              <h2 className="text-2xl font-bold text-white">{status.plan_name}</h2>
              <p className="text-gray-400 mt-1">
                {status.contacts_limit.toLocaleString()} contacts &bull;{' '}
                {status.price_monthly === 0 ? 'Free' : `$${status.price_monthly}/mo`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  status.subscription_status === 'active'
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : status.subscription_status === 'canceled'
                    ? 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                    : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                }`}
              >
                {status.subscription_status}
              </span>
              {status.stripe_subscription_id && (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {status?.available_plans.map((plan) => {
          const isCurrent = status.plan === plan.id;
          const features = planFeatures[plan.id] || [];
          const isPopular = plan.id === 'pro';

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
                isCurrent
                  ? 'bg-indigo-500/10 border-indigo-500/40'
                  : isPopular
                  ? 'bg-white/7 border-white/20'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {isPopular && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white">
                  Current Plan
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-white">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-white">${plan.price}</span>
                      <span className="text-gray-400 text-sm">/mo</span>
                    </>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
              </div>

              <ul className="flex-1 space-y-2 mb-6">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-400 cursor-default border border-white/10"
                >
                  Current Plan
                </button>
              ) : plan.id === 'free' ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-400 cursor-default border border-white/10"
                >
                  Downgrade via support
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id as 'pro' | 'business')}
                  disabled={upgrading !== null}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isPopular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {upgrading === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Redirecting...
                    </span>
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-gray-500 text-center">
        Payments are processed securely by Stripe. Cancel anytime.
      </p>
    </div>
  );
}
