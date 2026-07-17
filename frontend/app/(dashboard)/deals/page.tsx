'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import PipelineKanban from '@/components/deals/PipelineKanban';
import NewDealModal from '@/components/deals/NewDealModal';
import SuggestionsDrawer from '@/components/deals/SuggestionsDrawer';
import { listSuggestions } from '@/lib/api/suggestions';
import type { Deal, DealStage, Pipeline } from '@/types/deals';

type NewDealData = Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt'>;

const PIPELINE_TABS: { id: Pipeline; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'leasing', label: 'Leasing' },
];

export default function DealsPage() {
  const [pipeline, setPipeline] = useState<Pipeline>('sales');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingDeal, setPendingDeal] = useState<NewDealData | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialStage, setInitialStage] = useState<DealStage | null>(null);

  const handleAddDealAtStage = useCallback((stage: DealStage) => {
    setInitialStage(stage);
    setIsModalOpen(true);
  }, []);

  const refreshBadge = useCallback(() => {
    listSuggestions()
      .then((s) => setPendingCount(s.length))
      .catch(() => setPendingCount(0));
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  const handleNewDeal = useCallback((deal: NewDealData) => {
    setPendingDeal(deal);
  }, []);

  const handleDealAdded = useCallback(() => {
    setPendingDeal(null);
  }, []);

  const handleSuggestionResolved = useCallback(() => {
    setRefreshKey((k) => k + 1); // re-fetch the board — an accepted suggestion moved a card
    refreshBadge();
  }, [refreshBadge]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="relative flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-800"
          >
            <Sparkles className="h-4 w-4 text-primary-500" />
            AI Suggestions
            {pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-500 px-1 text-xs font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-colors hover:from-primary-600 hover:to-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            <Plus className="h-4 w-4" />
            New Deal
          </button>
        </div>
      </div>

      {/* Pipeline Tabs */}
      <div className="mb-4 flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-zinc-900">
        {PIPELINE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPipeline(tab.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              pipeline === tab.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <PipelineKanban
        pipeline={pipeline}
        pendingDeal={pendingDeal}
        onDealAdded={handleDealAdded}
        onAddDeal={handleAddDealAtStage}
        refreshKey={refreshKey}
      />

      {/* New Deal Modal */}
      <NewDealModal
        isOpen={isModalOpen}
        pipeline={pipeline}
        initialStage={initialStage}
        onClose={() => {
          setIsModalOpen(false);
          setInitialStage(null);
        }}
        onSubmit={handleNewDeal}
      />

      {/* AI Suggestions Drawer */}
      <SuggestionsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onResolved={handleSuggestionResolved}
      />
    </div>
  );
}
