'use client';

import { useState } from 'react';

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

interface Props {
  wallet: WalletData | null;
  userId?: string;
  onTopUp?: (amount: number) => void;
  loading?: boolean;
}

const TOP_UP_OPTIONS = [
  { amount: 10, label: '$10', minutes: '~100 mins' },
  { amount: 25, label: '$25', minutes: '~250 mins' },
  { amount: 50, label: '$50', minutes: '~500 mins' },
  { amount: 100, label: '$100', minutes: '~1000 mins' },
];

export function WalletCard({ wallet, userId, onTopUp, loading }: Props) {
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [topUpLoading, setTopUpLoading] = useState(false);

  const balance = wallet?.balance ?? 0;
  const isLowBalance = wallet ? balance < wallet.lowBalanceAt : false;

  const handleTopUp = async (amount: number) => {
    if (onTopUp) {
      setTopUpLoading(true);
      try {
        await onTopUp(amount);
      } finally {
        setTopUpLoading(false);
        setShowTopUp(false);
        setSelectedAmount(null);
      }
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

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'top_up':
        return '💳';
      case 'usage_deduction':
        return '📞';
      case 'bonus':
        return '🎁';
      case 'refund':
        return '↩️';
      default:
        return '📄';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] p-6 animate-pulse">
        <div className="h-6 bg-[#2a2a2a] rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-[#2a2a2a] rounded w-1/2 mb-6"></div>
        <div className="h-4 bg-[#2a2a2a] rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Wallet Balance</h3>
          {isLowBalance && (
            <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
              Low Balance
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${isLowBalance ? 'text-amber-400' : 'text-[#00D9FF]'}`}>
            {formatCurrency(balance)}
          </span>
          <span className="text-gray-500 text-sm">available</span>
        </div>

        {wallet && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-xs">This Month</p>
              <p className="text-white font-medium">
                {wallet.monthlyMinutes.toFixed(1)} mins
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Monthly Spend</p>
              <p className="text-white font-medium">
                {formatCurrency(wallet.monthlyCost)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top-up Section */}
      <div className="p-6 border-b border-[#2a2a2a]">
        {!showTopUp ? (
          <button
            onClick={() => setShowTopUp(true)}
            className="w-full py-3 px-4 bg-[#00D9FF] hover:bg-[#00D9FF]/90 text-black font-medium rounded-lg transition-colors"
          >
            Add Credits
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Select amount to add:</p>
            <div className="grid grid-cols-2 gap-2">
              {TOP_UP_OPTIONS.map((option) => (
                <button
                  key={option.amount}
                  onClick={() => setSelectedAmount(option.amount)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedAmount === option.amount
                      ? 'border-[#00D9FF] bg-[#00D9FF]/10'
                      : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                  }`}
                >
                  <p className="text-white font-semibold">{option.label}</p>
                  <p className="text-gray-500 text-xs">{option.minutes}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowTopUp(false);
                  setSelectedAmount(null);
                }}
                className="flex-1 py-2 px-4 border border-[#2a2a2a] text-gray-400 rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedAmount && handleTopUp(selectedAmount)}
                disabled={!selectedAmount || topUpLoading}
                className="flex-1 py-2 px-4 bg-[#00D9FF] hover:bg-[#00D9FF]/90 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {topUpLoading ? 'Processing...' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {wallet?.transactions && wallet.transactions.length > 0 && (
        <div className="p-6">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h4>
          <div className="space-y-3">
            {wallet.transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getTransactionIcon(tx.type)}</span>
                  <div>
                    <p className="text-white text-sm">
                      {tx.description || tx.type.replace('_', ' ')}
                    </p>
                    <p className="text-gray-500 text-xs">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <span
                  className={`font-medium ${
                    tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
