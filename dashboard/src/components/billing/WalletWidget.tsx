'use client';

import Link from 'next/link';

interface Props {
  balance: number;
  lowBalanceAt?: number;
  loading?: boolean;
}

export function WalletWidget({ balance, lowBalanceAt = 5, loading }: Props) {
  const isLowBalance = balance < lowBalanceAt;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  return (
    <Link href="/billing" className="block">
      <div
        className={`rounded-xl border p-4 transition-all hover:shadow-md ${
          isLowBalance
            ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
            : 'bg-white border-gray-200 hover:border-mautic-blue'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs mb-1">Wallet Balance</p>
            <p
              className={`text-xl font-bold ${
                isLowBalance ? 'text-amber-600' : 'text-gray-900'
              }`}
            >
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isLowBalance && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Low
              </span>
            )}
            <span className="text-mautic-blue text-xs hover:underline">
              Add Credits →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
