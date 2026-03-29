export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  id: string;
  contactName: string;
  email: string;
  company: string;
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
