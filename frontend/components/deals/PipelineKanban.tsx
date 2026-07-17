'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Deal, DealStage, Pipeline, PipelineStage } from '@/types/deals';
import DealCard from './DealCard';
import {
  listDeals,
  listStages,
  updateDeal,
  deleteDeal,
  createDeal,
  type ApiDeal,
} from '@/lib/api/deals';

// Map backend priority (low/medium/high) → frontend priority (cold/warm/hot)
function apiPriorityToFrontend(p: ApiDeal['priority']): Deal['priority'] {
  if (p === 'high') return 'hot';
  if (p === 'medium') return 'warm';
  return 'cold';
}

// Map frontend priority (cold/warm/hot) → backend priority (low/medium/high)
function frontendPriorityToApi(p: Deal['priority']): ApiDeal['priority'] {
  if (p === 'hot') return 'high';
  if (p === 'warm') return 'medium';
  return 'low';
}

function apiDealToFrontend(d: ApiDeal): Deal {
  return {
    id: d.id,
    title: d.title,
    contactName: d.contact_name ?? '',
    email: '',
    company: d.property_name ?? '',
    propertyName: d.property_name ?? '',
    pipeline: d.pipeline,
    value: d.value,
    stage: d.stage as DealStage,
    priority: apiPriorityToFrontend(d.priority),
    notes: d.notes ?? '',
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    stageChangedAt: d.stage_changed_at ?? d.updated_at,
  };
}

// Backend stage colors → tailwind dot classes (static literals for JIT)
const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-yellow-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  gray: 'bg-gray-500',
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value}`;
}

interface PipelineKanbanProps {
  pipeline: Pipeline;
  pendingDeal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt'> | null;
  onDealAdded: () => void;
  onAddDeal?: (stage: DealStage) => void;
  refreshKey?: number;
}

export default function PipelineKanban({
  pipeline,
  pendingDeal,
  onDealAdded,
  onAddDeal,
  refreshKey = 0,
}: PipelineKanbanProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  // Fetch stages + deals whenever the active pipeline changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([listStages(pipeline), listDeals(pipeline)])
      .then(([apiStages, apiDeals]) => {
        if (cancelled) return;
        setStages(
          apiStages.map((s) => ({
            id: s.id as DealStage,
            label: s.name,
            color: COLOR_CLASSES[s.color] ?? 'bg-gray-500',
          }))
        );
        setDeals(apiDeals.map(apiDealToFrontend));
      })
      .catch((err) => console.error('[PipelineKanban] failed to load board:', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pipeline, refreshKey]);

  // Process pending deal from parent — call API then optimistically append
  const [lastProcessedDeal, setLastProcessedDeal] = useState<typeof pendingDeal>(null);
  if (pendingDeal && pendingDeal !== lastProcessedDeal) {
    setLastProcessedDeal(pendingDeal);
    createDeal({
      title: pendingDeal.title || pendingDeal.contactName || 'Untitled Deal',
      contact_name: pendingDeal.contactName,
      value: pendingDeal.value,
      pipeline,
      stage: pendingDeal.stage,
      priority: frontendPriorityToApi(pendingDeal.priority),
      property_name: pendingDeal.propertyName || null,
      notes: pendingDeal.notes,
    })
      .then((apiDeal) => {
        setDeals((prev) => [...prev, apiDealToFrontend(apiDeal)]);
      })
      .catch((err) => console.error('[PipelineKanban] failed to create deal:', err));
    onDealAdded();
  }

  function getDealsForStage(stageId: DealStage): Deal[] {
    return deals.filter((deal) => deal.stage === stageId);
  }

  function getStageTotalValue(stageId: DealStage): number {
    return deals
      .filter((deal) => deal.stage === stageId)
      .reduce((sum, deal) => sum + deal.value, 0);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stageId: DealStage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetStage: DealStage) {
    e.preventDefault();
    setDragOverStage(null);

    const dealId = e.dataTransfer.getData('dealId');
    if (!dealId) return;

    const now = new Date().toISOString();

    // Optimistic update
    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId
          ? { ...deal, stage: targetStage, stageChangedAt: now, updatedAt: now }
          : deal
      )
    );

    // Persist to backend
    updateDeal(dealId, { stage: targetStage }).catch((err) => {
      console.error('[PipelineKanban] failed to update deal stage:', err);
      // Revert on failure by re-fetching
      listDeals(pipeline)
        .then((apiDeals) => setDeals(apiDeals.map(apiDealToFrontend)))
        .catch(() => {});
    });
  }

  const handleDeleteDeal = useCallback(
    (dealId: string) => {
      // Optimistic removal
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      deleteDeal(dealId).catch((err) => {
        console.error('[PipelineKanban] failed to delete deal:', err);
        // Revert on failure
        listDeals(pipeline)
          .then((apiDeals) => setDeals(apiDeals.map(apiDealToFrontend)))
          .catch(() => {});
      });
    },
    [pipeline]
  );

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex min-w-[280px] flex-shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-zinc-800/50 dark:bg-[#0f0f12]/50"
          >
            <div className="border-b border-gray-200 p-3 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-300 dark:bg-zinc-700" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="flex-1 p-2" style={{ minHeight: '120px' }}>
              <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageDeals = getDealsForStage(stage.id);
        const totalValue = getStageTotalValue(stage.id);
        const isDragOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            className={`flex min-w-[280px] flex-shrink-0 flex-col rounded-xl border transition-colors ${
              isDragOver
                ? 'border-primary-500 bg-primary-500/5'
                : 'border-gray-200 bg-gray-50 dark:border-zinc-800/50 dark:bg-[#0f0f12]/50'
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className="border-b border-gray-200 p-3 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stage.label}
                </h3>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                  {stageDeals.length}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {formatCurrency(totalValue)} total
              </p>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 p-2" style={{ minHeight: '120px' }}>
              {stageDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} onDelete={handleDeleteDeal} />
              ))}
              {stageDeals.length === 0 && (
                <button
                  type="button"
                  onClick={() => onAddDeal?.(stage.id)}
                  className="flex h-20 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-primary-500 hover:bg-primary-500/5 dark:border-zinc-700 dark:hover:border-primary-500"
                >
                  <p className="text-xs text-gray-400">+ Add deal</p>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
