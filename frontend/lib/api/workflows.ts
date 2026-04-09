/**
 * Workflows API client
 * Wraps /api/agent/workflows/* endpoints via agent-service (port 3008)
 * organizationId is passed explicitly since agent-service does not validate JWTs
 */

import { apiClient } from '@/lib/api';

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
}

export interface Workflow {
  id: string;
  name: string;
  created_at: string;
  step_count: number;
  active_enrollment_count: number;
}

export interface WorkflowDetail extends Omit<Workflow, 'step_count' | 'active_enrollment_count'> {
  steps: WorkflowStep[];
}

export interface WorkflowEnrollment {
  id: string;
  workflow_id: string;
  contact_id: string;
  contact_email: string;
  current_step: number;
  status: string;
  enrolled_at: string;
  next_send_at: string | null;
}

export interface WorkflowStepInput {
  delayDays: number;
  subject: string;
  body: string;
}

export async function listWorkflows(organizationId: string): Promise<Workflow[]> {
  const res = await apiClient.get<{ workflows: Workflow[] }>('/api/agent/workflows', {
    params: { organizationId },
  });
  return res.data.workflows;
}

export async function createWorkflow(
  organizationId: string,
  name: string,
  steps: WorkflowStepInput[],
): Promise<WorkflowDetail> {
  const res = await apiClient.post<{ workflow: WorkflowDetail }>('/api/agent/workflows', {
    organizationId,
    name,
    steps,
  });
  return res.data.workflow;
}

export async function deleteWorkflow(organizationId: string, id: string): Promise<void> {
  await apiClient.delete(`/api/agent/workflows/${id}`, { data: { organizationId } });
}

export async function listEnrollments(
  organizationId: string,
  workflowId: string,
): Promise<WorkflowEnrollment[]> {
  const res = await apiClient.get<{ enrollments: WorkflowEnrollment[] }>(
    `/api/agent/workflows/${workflowId}/enrollments`,
    { params: { organizationId } },
  );
  return res.data.enrollments;
}

export async function enrollContacts(
  organizationId: string,
  workflowId: string,
  contacts: Array<{ id: string; email: string }>,
): Promise<void> {
  await apiClient.post(`/api/agent/workflows/${workflowId}/enroll`, {
    organizationId,
    contacts,
  });
}

export async function enrollSegment(
  organizationId: string,
  workflowId: string,
  segmentId: string,
): Promise<{ enrolled: number }> {
  const res = await apiClient.post<{ enrolled: number }>(
    `/api/agent/workflows/${workflowId}/enroll-segment`,
    { organizationId, segmentId },
  );
  return res.data;
}
