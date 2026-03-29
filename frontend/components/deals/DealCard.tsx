'use client';

import { DollarSign, User, Building2, GripVertical } from 'lucide-react';
import type { Deal } from '@/types/deals';

interface DealCardProps {
  deal: Deal;
}

function getDaysInStage(stageChangedAt: string): number {
  const changed = new Date(stageChangedAt);
  const now = new Date();
  const diffMs = now.getTime() - changed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getPriorityStyles(priority: Deal['priority']): { bg: string; text: string; label: string } {
  switch (priority) {
    case 'hot':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Hot' };
    case 'warm':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Warm' };
    case 'cold':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Cold' };
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealCard({ deal }: DealCardProps) {
  const daysInStage = getDaysInStage(deal.stageChangedAt);
  const priority = getPriorityStyles(deal.priority);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('dealId', deal.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group cursor-grab rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:shadow-primary-500/10 active:cursor-grabbing dark:border-zinc-800/50 dark:bg-zinc-900"
    >
      {/* Header: grip + name */}
      <div className="mb-2 flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {deal.contactName}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {deal.company}
            </span>
          </div>
        </div>
      </div>

      {/* Value + Priority */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5 text-green-500" />
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            {formatCurrency(deal.value)}
          </span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priority.bg} ${priority.text}`}>
          {priority.label}
        </span>
      </div>

      {/* Days in stage */}
      <div className="mt-2 text-xs text-gray-400">
        {daysInStage === 0 ? 'Today' : `${daysInStage}d in stage`}
      </div>
    </div>
  );
}
