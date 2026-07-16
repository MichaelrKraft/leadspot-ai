export type Pipeline = 'sales' | 'leasing';

export type SalesStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type LeasingStage =
  | 'inquiry'
  | 'loi_negotiation'
  | 'construction_pricing'
  | 'lease_drafting'
  | 'lease_negotiation'
  | 'signed'
  | 'lost';
export type DealStage = SalesStage | LeasingStage;

export interface Deal {
  id: string;
  title: string;
  contactName: string;
  email: string;
  company: string;
  propertyName: string;
  pipeline: Pipeline;
  value: number;
  stage: DealStage;
  priority: 'hot' | 'warm' | 'cold';
  notes: string;
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string;
}

export interface PipelineStage {
  id: DealStage;
  label: string;
  color: string;
}
