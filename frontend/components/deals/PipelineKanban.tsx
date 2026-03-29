'use client';

import { useState } from 'react';
import type { Deal, DealStage, PipelineStage } from '@/types/deals';
import DealCard from './DealCard';

const STAGES: PipelineStage[] = [
  { id: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-yellow-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
  { id: 'lost', label: 'Lost', color: 'bg-red-500' },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const DEMO_DEALS: Deal[] = [
  {
    id: '1',
    contactName: 'Sarah Chen',
    email: 'sarah@techflow.io',
    company: 'TechFlow',
    value: 45000,
    stage: 'lead',
    priority: 'hot',
    notes: 'Inbound from webinar',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1),
    stageChangedAt: daysAgo(3),
  },
  {
    id: '2',
    contactName: 'Marcus Johnson',
    email: 'marcus@greenleaf.co',
    company: 'GreenLeaf Co',
    value: 12000,
    stage: 'lead',
    priority: 'warm',
    notes: 'Referred by existing client',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    stageChangedAt: daysAgo(5),
  },
  {
    id: '3',
    contactName: 'Emily Rodriguez',
    email: 'emily@datawise.com',
    company: 'DataWise',
    value: 78000,
    stage: 'qualified',
    priority: 'hot',
    notes: 'Enterprise plan interest',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
    stageChangedAt: daysAgo(7),
  },
  {
    id: '4',
    contactName: 'James Park',
    email: 'james@novasoft.dev',
    company: 'NovaSoft',
    value: 25000,
    stage: 'qualified',
    priority: 'cold',
    notes: 'Evaluating competitors',
    createdAt: daysAgo(15),
    updatedAt: daysAgo(3),
    stageChangedAt: daysAgo(10),
  },
  {
    id: '5',
    contactName: 'Lisa Wang',
    email: 'lisa@brightpath.ai',
    company: 'BrightPath AI',
    value: 120000,
    stage: 'proposal',
    priority: 'hot',
    notes: 'Proposal sent, awaiting review',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
    stageChangedAt: daysAgo(4),
  },
  {
    id: '6',
    contactName: 'Tom Bradley',
    email: 'tom@scaleup.io',
    company: 'ScaleUp',
    value: 35000,
    stage: 'negotiation',
    priority: 'warm',
    notes: 'Negotiating on pricing tier',
    createdAt: daysAgo(25),
    updatedAt: daysAgo(0),
    stageChangedAt: daysAgo(2),
  },
  {
    id: '7',
    contactName: 'Rachel Kim',
    email: 'rachel@urbantech.co',
    company: 'UrbanTech',
    value: 55000,
    stage: 'negotiation',
    priority: 'hot',
    notes: 'Final contract review',
    createdAt: daysAgo(40),
    updatedAt: daysAgo(0),
    stageChangedAt: daysAgo(1),
  },
  {
    id: '8',
    contactName: 'David Miller',
    email: 'david@cloudnine.dev',
    company: 'CloudNine',
    value: 90000,
    stage: 'won',
    priority: 'hot',
    notes: 'Signed annual contract',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
    stageChangedAt: daysAgo(5),
  },
  {
    id: '9',
    contactName: 'Anna Foster',
    email: 'anna@blueridge.co',
    company: 'BlueRidge',
    value: 18000,
    stage: 'won',
    priority: 'warm',
    notes: 'Onboarding started',
    createdAt: daysAgo(45),
    updatedAt: daysAgo(10),
    stageChangedAt: daysAgo(10),
  },
  {
    id: '10',
    contactName: 'Chris Taylor',
    email: 'chris@nexgen.io',
    company: 'NexGen',
    value: 8000,
    stage: 'lost',
    priority: 'cold',
    notes: 'Went with competitor',
    createdAt: daysAgo(35),
    updatedAt: daysAgo(14),
    stageChangedAt: daysAgo(14),
  },
];

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value}`;
}

interface PipelineKanbanProps {
  pendingDeal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt'> | null;
  onDealAdded: () => void;
}

export default function PipelineKanban({ pendingDeal, onDealAdded }: PipelineKanbanProps) {
  const [deals, setDeals] = useState<Deal[]>(DEMO_DEALS);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  // Process pending deal from parent
  const [lastProcessedDeal, setLastProcessedDeal] = useState<typeof pendingDeal>(null);
  if (pendingDeal && pendingDeal !== lastProcessedDeal) {
    const now = new Date().toISOString();
    const deal: Deal = {
      ...pendingDeal,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      stageChangedAt: now,
    };
    setDeals((prev) => [...prev, deal]);
    setLastProcessedDeal(pendingDeal);
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

    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId
          ? {
              ...deal,
              stage: targetStage,
              stageChangedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : deal
      )
    );
  }


  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageDeals = getDealsForStage(stage.id);
        const totalValue = getStageTotalValue(stage.id);
        const isDragOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            className={`flex min-w-[280px] flex-shrink-0 flex-col rounded-xl border transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50'
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stage.label}
                </h3>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
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
                <DealCard key={deal.id} deal={deal} />
              ))}
              {stageDeals.length === 0 && (
                <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-xs text-gray-400">Drop deals here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

