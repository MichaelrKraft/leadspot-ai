'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WalletCard, UsageChart } from '@/components/billing';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
}

interface WalletData {
  id: string;
  balance: number;
  lowBalanceAt: number;
  monthlyMinutes: number;
  monthlyCost: number;
  transactions: Transaction[];
}

interface DailyUsage {
  date: string;
  minutes: number;
  cost: number;
  calls: number;
}

interface UsageStats {
  totalMinutes: number;
  totalCost: number;
  totalMargin: number;
  callCount: number;
}

interface UsageRecord {
  id: string;
  minutes: number;
  totalCost: number;
  createdAt: string;
  call?: {
    id: string;
    phoneNumber: string;
    direction: string;
    outcome?: string;
    agent?: { id: string; name: string };
  };
}


export default function BillingDashboard() {
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [stats, setStats] = useState<UsageStats>({
    totalMinutes: 0,
    totalCost: 0,
    totalMargin: 0,
    callCount: 0,
  });
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Payment successful! Credits have been added to your wallet.');
      // Clear the URL params
      window.history.replaceState({}, '', '/billing');
    }
    if (searchParams.get('canceled') === 'true') {
      setError('Payment was canceled.');
      window.history.replaceState({}, '', '/billing');
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [walletRes, usageRes] = await Promise.all([
        fetch('/api/billing/wallet'),
        fetch(`/api/billing/usage?period=${period}`),
      ]);

      if (!walletRes.ok) {
        throw new Error('Failed to load wallet');
      }

      const walletData = await walletRes.json();
      setWallet(walletData);

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData.usage || []);
        setDailyUsage(usageData.dailyUsage || []);
        setStats(usageData.stats || {
          totalMinutes: 0,
          totalCost: 0,
          totalMargin: 0,
          callCount: 0,
        });
      }
    } catch (err) {
      console.error('Error loading billing data:', err);
      setError('Failed to load billing data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async (amount: number) => {
    try {
      const res = await fetch('/api/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else if (data.mode === 'development') {
        // Development mode - simulate adding credits
        const addRes = await fetch('/api/billing/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            type: 'top_up',
            description: `Added $${amount} (dev mode)`,
          }),
        });

        if (addRes.ok) {
          setSuccessMessage(`Added $${amount} to your wallet (development mode)`);
          loadData();
        }
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError('Failed to start checkout. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !wallet) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-mautic-blue mx-auto mb-4"></div>
          <p className="text-gray-500">Loading billing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Usage</h1>
          <p className="text-gray-500 text-sm">
            Manage your voice AI credits and view usage history
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Rate: <span className="font-medium text-gray-900">$0.10/min</span>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-green-600 text-xl">✓</span>
            <p className="text-green-700">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-600 text-xl">!</span>
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet Card */}
        <div className="lg:col-span-1">
          <WalletCard
            wallet={wallet}
            onTopUp={handleTopUp}
            loading={loading}
          />
        </div>

        {/* Usage Chart */}
        <div className="lg:col-span-2">
          <UsageChart
            dailyUsage={dailyUsage}
            stats={stats}
            period={period}
            onPeriodChange={setPeriod}
            loading={loading}
          />
        </div>
      </div>

      {/* Usage History Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Usage History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Outcome
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No usage records for this period
                  </td>
                </tr>
              ) : (
                usage.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.call?.phoneNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.call?.agent?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.minutes.toFixed(1)} mins
                    </td>
                    <td className="px-6 py-4">
                      {record.call?.outcome && (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            record.call.outcome === 'qualified'
                              ? 'bg-green-100 text-green-700'
                              : record.call.outcome === 'appointment_booked'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {record.call.outcome.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(record.totalCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Info */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          💡 Voice AI Pricing
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl mb-2">📞</div>
            <h4 className="font-medium text-gray-900">$0.10 per minute</h4>
            <p className="text-gray-500 mt-1">
              Simple per-minute billing for all voice calls.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl mb-2">🎁</div>
            <h4 className="font-medium text-gray-900">$5 Welcome Credit</h4>
            <p className="text-gray-500 mt-1">
              New accounts receive 50 free minutes to get started.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl mb-2">⚡</div>
            <h4 className="font-medium text-gray-900">No Monthly Fees</h4>
            <p className="text-gray-500 mt-1">
              Only pay for what you use. Top up anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
