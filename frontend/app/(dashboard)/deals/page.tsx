'use client';

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import PipelineKanban from '@/components/deals/PipelineKanban';
import NewDealModal from '@/components/deals/NewDealModal';
import type { Deal } from '@/types/deals';

type NewDealData = Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt'>;

export default function DealsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingDeal, setPendingDeal] = useState<NewDealData | null>(null);

  const handleNewDeal = useCallback((deal: NewDealData) => {
    setPendingDeal(deal);
  }, []);

  const handleDealAdded = useCallback(() => {
    setPendingDeal(null);
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deals Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Drag and drop deals between stages to update their status.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-colors hover:from-primary-600 hover:to-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
        >
          <Plus className="h-4 w-4" />
          New Deal
        </button>
      </div>

      {/* Kanban Board */}
      <PipelineKanban pendingDeal={pendingDeal} onDealAdded={handleDealAdded} />

      {/* New Deal Modal */}
      <NewDealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleNewDeal}
      />
    </div>
  );
}
