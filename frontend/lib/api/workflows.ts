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
  step_type: string;
  action_config: string; // JSON
  branch_condition: string | null; // JSON or null
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
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_company: string | null;
  paused_at: string | null;
  pause_reason: string | null;
}

export interface WorkflowGoal {
  id: string;
  workflow_id: string;
  condition_type: string;
  condition_value: string;
  created_at: string;
}

export interface WorkflowStepInput {
  delayDays: number;
  subject: string;
  body: string;
  stepType?: 'send_email' | 'add_tag' | 'remove_tag' | 'webhook';
  actionConfig?: {
    tagName?: string;
    webhookUrl?: string;
    webhookMethod?: string;
    webhookBody?: string;
  };
  branchCondition?: {
    type: 'email_opened' | 'tag_has';
    value?: string;
    true_next_step: number;
    false_next_step: number;
  } | null;
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

export async function getWorkflow(organizationId: string, id: string): Promise<WorkflowDetail> {
  const res = await apiClient.get<{ workflow: WorkflowDetail }>(`/api/agent/workflows/${id}`, {
    params: { organizationId },
  });
  return res.data.workflow;
}

export async function updateWorkflow(
  organizationId: string,
  id: string,
  name: string,
  steps: WorkflowStepInput[],
): Promise<WorkflowDetail> {
  const res = await apiClient.put<{ workflow: WorkflowDetail }>(`/api/agent/workflows/${id}`, {
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

export async function pauseEnrollment(
  organizationId: string,
  workflowId: string,
  enrollmentId: string,
): Promise<void> {
  await apiClient.patch(`/api/agent/workflows/${workflowId}/enrollments/${enrollmentId}/pause`, { organizationId });
}

export async function resumeEnrollment(
  organizationId: string,
  workflowId: string,
  enrollmentId: string,
): Promise<void> {
  await apiClient.patch(`/api/agent/workflows/${workflowId}/enrollments/${enrollmentId}/resume`, { organizationId });
}

export async function cancelEnrollment(
  organizationId: string,
  workflowId: string,
  enrollmentId: string,
): Promise<void> {
  await apiClient.patch(`/api/agent/workflows/${workflowId}/enrollments/${enrollmentId}/cancel`, { organizationId });
}

export async function refreshEnrollmentContact(
  organizationId: string,
  workflowId: string,
  enrollmentId: string,
): Promise<void> {
  await apiClient.post(`/api/agent/workflows/${workflowId}/enrollments/${enrollmentId}/refresh`, { organizationId });
}

export async function listGoals(organizationId: string, workflowId: string): Promise<WorkflowGoal[]> {
  const res = await apiClient.get<{ goals: WorkflowGoal[] }>(
    `/api/agent/workflows/${workflowId}/goals`,
    { params: { organizationId } },
  );
  return res.data.goals;
}

export async function addGoal(
  organizationId: string,
  workflowId: string,
  conditionType: string,
  conditionValue: string,
): Promise<WorkflowGoal> {
  const res = await apiClient.post<{ goal: WorkflowGoal }>(
    `/api/agent/workflows/${workflowId}/goals`,
    { organizationId, conditionType, conditionValue },
  );
  return res.data.goal;
}

export async function removeGoal(
  organizationId: string,
  workflowId: string,
  goalId: string,
): Promise<void> {
  await apiClient.delete(`/api/agent/workflows/${workflowId}/goals/${goalId}`, {
    data: { organizationId },
  });
}
