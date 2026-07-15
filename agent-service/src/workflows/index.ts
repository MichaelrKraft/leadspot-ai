/**
 * LeadSpot Workflows — multi-step email sequence engine
 *
 * Stores workflows, steps, and enrollments in the per-org SQLite DB.
 * Execution is driven by a recurring CronService job ('process_workflow_steps').
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../db';
import { createCronService } from '../cron';

const BACKEND_API_URL = process.env.LEADSPOT_API_URL || 'http://localhost:8000';

// ============================================================================
// Types
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkflowListItem extends Workflow {
  step_count: number;
  active_enrollment_count: number;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
  step_type: 'send_email' | 'add_tag' | 'remove_tag' | 'webhook';
  action_config: string; // JSON string
  branch_condition: string | null; // JSON string or null
}

interface BranchCondition {
  type: 'email_opened' | 'tag_has';
  value?: string;           // tag name for 'tag_has'
  true_next_step: number;   // step_order to jump to if condition is true
  false_next_step: number;  // step_order to jump to if condition is false
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
  contact_tags: string | null;
  paused_at: string | null;
  pause_reason: string | null;
}

export interface GoalCondition {
  id: string;
  workflow_id: string;
  condition_type: string;
  condition_value: string;
  created_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert Date to SQLite datetime string (UTC, space separator) */
function toSqliteDate(d: Date): string {
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/** Substitute {variable} tokens in a string from a flat map */
function interpolateVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** Fetch contact details from the backend. Returns empty strings on failure. */
async function fetchContactDetails(
  contactId: string,
  authHeader?: string,
): Promise<{ firstName: string; lastName: string; company: string; tags: string[] }> {
  try {
    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;
    const res = await fetch(`${BACKEND_API_URL}/api/contacts/${contactId}`, { headers });
    if (!res.ok) return { firstName: '', lastName: '', company: '', tags: [] };
    const data = await res.json() as {
      firstName?: string;
      lastName?: string;
      company?: string;
      tags?: string[];
    };
    return {
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      company: data.company ?? '',
      tags: data.tags ?? [],
    };
  } catch {
    return { firstName: '', lastName: '', company: '', tags: [] };
  }
}

/** Check if any goal condition is met for an enrollment (uses cached tags). */
function checkGoalConditions(
  db: Database.Database,
  workflowId: string,
  cachedTagsJson: string | null,
): boolean {
  const goals = db.prepare(
    'SELECT * FROM workflow_goal_conditions WHERE workflow_id = ?',
  ).all(workflowId) as GoalCondition[];
  if (goals.length === 0) return false;

  const tags: string[] = cachedTagsJson ? (JSON.parse(cachedTagsJson) as string[]) : [];
  return goals.some(
    (g) => g.condition_type === 'tag_added' && tags.includes(g.condition_value),
  );
}

// ============================================================================
// CRUD
// ============================================================================

export function listWorkflows(db: Database.Database): WorkflowListItem[] {
  return db.prepare(`
    SELECT
      w.*,
      (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id) AS step_count,
      (SELECT COUNT(*) FROM workflow_enrollments WHERE workflow_id = w.id AND status = 'active') AS active_enrollment_count
    FROM workflows w
    ORDER BY w.created_at DESC
  `).all() as WorkflowListItem[];
}

export function createWorkflow(
  db: Database.Database,
  name: string,
  steps: Array<{
    delayDays: number;
    subject?: string;
    body?: string;
    stepType?: string;
    actionConfig?: Record<string, string>;
    branchCondition?: BranchCondition | null;
  }>,
): Workflow {
  const id = randomUUID();
  db.prepare('INSERT INTO workflows (id, name) VALUES (?, ?)').run(id, name);

  const insertStep = db.prepare(
    'INSERT INTO workflow_steps (id, workflow_id, step_order, delay_days, subject, body, step_type, action_config, branch_condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  steps.forEach((step, index) => {
    insertStep.run(
      randomUUID(), id, index,
      step.delayDays,
      step.subject ?? '',
      step.body ?? '',
      step.stepType ?? 'send_email',
      step.actionConfig ? JSON.stringify(step.actionConfig) : '{}',
      step.branchCondition ? JSON.stringify(step.branchCondition) : null,
    );
  });

  return db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Workflow;
}

export function getWorkflow(
  db: Database.Database,
  id: string,
): (Workflow & { steps: WorkflowStep[] }) | null {
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Workflow | undefined;
  if (!workflow) return null;

  const steps = db.prepare(
    'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order',
  ).all(id) as WorkflowStep[];

  return { ...workflow, steps };
}

export function updateWorkflow(
  db: Database.Database,
  id: string,
  name: string,
  steps: Array<{
    delayDays: number;
    subject?: string;
    body?: string;
    stepType?: string;
    actionConfig?: Record<string, string>;
    branchCondition?: BranchCondition | null;
  }>,
): (Workflow & { steps: WorkflowStep[] }) | null {
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Workflow | undefined;
  if (!existing) return null;

  db.prepare('UPDATE workflows SET name = ? WHERE id = ?').run(name, id);
  db.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(id);

  const insertStep = db.prepare(
    'INSERT INTO workflow_steps (id, workflow_id, step_order, delay_days, subject, body, step_type, action_config, branch_condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  steps.forEach((step, index) => {
    insertStep.run(
      randomUUID(), id, index,
      step.delayDays,
      step.subject ?? '',
      step.body ?? '',
      step.stepType ?? 'send_email',
      step.actionConfig ? JSON.stringify(step.actionConfig) : '{}',
      step.branchCondition ? JSON.stringify(step.branchCondition) : null,
    );
  });

  return getWorkflow(db, id);
}

export function deleteWorkflow(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM workflow_enrollments WHERE workflow_id = ?').run(id);
  db.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(id);
  db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
}

export function listEnrollments(
  db: Database.Database,
  workflowId: string,
): WorkflowEnrollment[] {
  return db.prepare(
    'SELECT * FROM workflow_enrollments WHERE workflow_id = ? ORDER BY enrolled_at DESC',
  ).all(workflowId) as WorkflowEnrollment[];
}

export function pauseEnrollment(
  db: Database.Database,
  enrollmentId: string,
  reason?: string,
): void {
  db.prepare(`
    UPDATE workflow_enrollments
    SET status = 'paused', paused_at = datetime('now'), pause_reason = ?
    WHERE id = ? AND status = 'active'
  `).run(reason ?? null, enrollmentId);
}

export function resumeEnrollment(
  db: Database.Database,
  enrollmentId: string,
): void {
  db.prepare(`
    UPDATE workflow_enrollments
    SET status = 'active', paused_at = NULL, pause_reason = NULL, next_send_at = datetime('now')
    WHERE id = ? AND status = 'paused'
  `).run(enrollmentId);
}

export function cancelEnrollment(
  db: Database.Database,
  enrollmentId: string,
): void {
  db.prepare(`
    UPDATE workflow_enrollments SET status = 'cancelled' WHERE id = ?
  `).run(enrollmentId);
}

export async function refreshEnrollmentContact(
  db: Database.Database,
  enrollmentId: string,
  authHeader?: string,
): Promise<void> {
  const enrollment = db.prepare(
    'SELECT * FROM workflow_enrollments WHERE id = ?',
  ).get(enrollmentId) as WorkflowEnrollment | undefined;
  if (!enrollment) return;

  const details = await fetchContactDetails(enrollment.contact_id, authHeader);
  db.prepare(`
    UPDATE workflow_enrollments
    SET contact_first_name = ?, contact_last_name = ?, contact_company = ?, contact_tags = ?
    WHERE id = ?
  `).run(details.firstName, details.lastName, details.company, JSON.stringify(details.tags), enrollmentId);
}

// ============================================================================
// Goal Conditions
// ============================================================================

export function listGoals(db: Database.Database, workflowId: string): GoalCondition[] {
  return db.prepare(
    'SELECT * FROM workflow_goal_conditions WHERE workflow_id = ? ORDER BY created_at',
  ).all(workflowId) as GoalCondition[];
}

export function addGoal(
  db: Database.Database,
  workflowId: string,
  conditionType: string,
  conditionValue: string,
): GoalCondition {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO workflow_goal_conditions (id, workflow_id, condition_type, condition_value)
    VALUES (?, ?, ?, ?)
  `).run(id, workflowId, conditionType, conditionValue);
  return db.prepare(
    'SELECT * FROM workflow_goal_conditions WHERE id = ?',
  ).get(id) as GoalCondition;
}

export function removeGoal(db: Database.Database, goalId: string): void {
  db.prepare('DELETE FROM workflow_goal_conditions WHERE id = ?').run(goalId);
}

// ============================================================================
// Enrollment
// ============================================================================

/**
 * Ensure the recurring 'process_workflow_steps' cron job exists and is
 * running for an org. addJob uses UNIQUE(org, name) so repeat calls are
 * idempotent. Called both on enrollment and at startup for every org on
 * disk, so drip processing resumes after a restart.
 */
export async function ensureWorkflowCron(orgId: string): Promise<void> {
  const cronService = createCronService();
  await cronService.addJob(
    'process_workflow_steps',
    { kind: 'every', everyMs: 5 * 60 * 1000 }, // every 5 minutes
    { message: 'Process due workflow email steps', action: 'process_workflow_steps' },
    orgId,
    { enabled: true },
  );
  if (!cronService.isRunning()) {
    await cronService.startForOrg(orgId);
  }
}

export async function enrollContacts(
  db: Database.Database,
  workflowId: string,
  orgId: string,
  contacts: Array<{ id: string; email: string }>,
  authHeader?: string,
): Promise<void> {
  const steps = db.prepare(
    'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order',
  ).all(workflowId) as WorkflowStep[];

  if (steps.length === 0) {
    throw new Error('Workflow has no steps');
  }

  const firstStep = steps[0];
  const nextSendAt = toSqliteDate(new Date(Date.now() + firstStep.delay_days * 86400000));

  const insertEnrollment = db.prepare(`
    INSERT INTO workflow_enrollments
      (id, workflow_id, contact_id, contact_email, current_step, status, next_send_at,
       contact_first_name, contact_last_name, contact_company, contact_tags)
    VALUES (?, ?, ?, ?, 0, 'active', ?, ?, ?, ?, ?)
  `);

  for (const contact of contacts) {
    // Skip if already actively enrolled
    const existing = db.prepare(
      "SELECT id FROM workflow_enrollments WHERE workflow_id = ? AND contact_id = ? AND status = 'active'",
    ).get(workflowId, contact.id);
    if (existing) continue;

    const details = await fetchContactDetails(contact.id, authHeader);
    insertEnrollment.run(
      randomUUID(), workflowId, contact.id, contact.email, nextSendAt,
      details.firstName, details.lastName, details.company,
      JSON.stringify(details.tags),
    );
  }

  await ensureWorkflowCron(orgId);
}

// ============================================================================
// Execution
// ============================================================================

/**
 * Send an email step — delegates to the email service.
 * Returns true when the enrollment should advance (sent, or suppressed —
 * a suppressed contact must not be retried) and false on send failure so
 * the step is retried on the next processing run.
 */
async function executeSendEmailStep(
  enrollment: WorkflowEnrollment,
  step: WorkflowStep,
  orgId: string,
  vars: Record<string, string>,
): Promise<boolean> {
  const { sendEmail } = await import('../services/email');
  const result = await sendEmail({
    to: enrollment.contact_email,
    subject: interpolateVariables(step.subject, vars),
    body: interpolateVariables(step.body, vars),
    contactId: enrollment.contact_id,
    organizationId: orgId,
    enrollmentId: enrollment.id,
  });
  if (result.suppressed) {
    console.log(`[Workflows] Skipping suppressed contact ${enrollment.contact_email} (enrollment ${enrollment.id})`);
    return true;
  }
  if (!result.success) {
    console.error(`[Workflows] Email send failed for enrollment ${enrollment.id}: ${result.error}`);
    return false;
  }
  return true;
}

/** Add or remove a tag on the contact via the backend API. */
async function executeTagStep(
  db: Database.Database,
  enrollment: WorkflowEnrollment,
  step: WorkflowStep,
  mode: 'add' | 'remove',
): Promise<boolean> {
  const config = JSON.parse(step.action_config) as { tagName?: string };
  if (!config.tagName) return true;

  let currentTags: string[] = enrollment.contact_tags
    ? (JSON.parse(enrollment.contact_tags) as string[])
    : [];

  try {
    const fetchRes = await fetch(`${BACKEND_API_URL}/api/contacts/${enrollment.contact_id}`);
    if (fetchRes.ok) {
      const data = await fetchRes.json() as { tags?: string[] };
      currentTags = data.tags ?? currentTags;
    }
  } catch {
    // Fall back to cached tags — cron must not crash
  }

  const updatedTags = mode === 'add'
    ? currentTags.includes(config.tagName) ? currentTags : [...currentTags, config.tagName]
    : currentTags.filter((t) => t !== config.tagName);

  try {
    await fetch(`${BACKEND_API_URL}/api/contacts/${enrollment.contact_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags }),
    });
  } catch {
    // Fail gracefully — cron must not crash
  }

  // Keep cached tags in sync so goal conditions stay accurate
  db.prepare(
    'UPDATE workflow_enrollments SET contact_tags = ? WHERE id = ?',
  ).run(JSON.stringify(updatedTags), enrollment.id);

  return true;
}

/** Fire a configurable HTTP webhook. */
async function executeWebhookStep(
  step: WorkflowStep,
  vars: Record<string, string>,
): Promise<boolean> {
  const config = JSON.parse(step.action_config) as {
    webhookUrl?: string;
    webhookMethod?: string;
    webhookBody?: string;
  };
  if (!config.webhookUrl) return true;

  const method = config.webhookMethod ?? 'POST';
  const body = config.webhookBody
    ? interpolateVariables(config.webhookBody, vars)
    : undefined;

  try {
    await fetch(config.webhookUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ?? undefined,
    });
  } catch {
    // Fail gracefully — cron must not crash
  }

  return true;
}

/** Dispatch a single step to the correct handler. */
async function executeStep(
  db: Database.Database,
  enrollment: WorkflowEnrollment,
  step: WorkflowStep,
  orgId: string,
  vars: Record<string, string>,
): Promise<boolean> {
  switch (step.step_type ?? 'send_email') {
    case 'send_email':
      return executeSendEmailStep(enrollment, step, orgId, vars);
    case 'add_tag':
      return executeTagStep(db, enrollment, step, 'add');
    case 'remove_tag':
      return executeTagStep(db, enrollment, step, 'remove');
    case 'webhook':
      return executeWebhookStep(step, vars);
    default:
      return true; // unknown step types pass through
  }
}

/** Evaluate a branch condition and return true/false. */
function evaluateBranchCondition(
  db: Database.Database,
  condition: BranchCondition,
  enrollment: WorkflowEnrollment,
): boolean {
  if (condition.type === 'email_opened') {
    const opened = db.prepare(
      "SELECT id FROM workflow_email_events WHERE enrollment_id = ? AND event_type = 'opened' LIMIT 1",
    ).get(enrollment.id);
    return !!opened;
  }
  if (condition.type === 'tag_has') {
    const tags: string[] = enrollment.contact_tags
      ? (JSON.parse(enrollment.contact_tags) as string[])
      : [];
    return tags.includes(condition.value ?? '');
  }
  return false;
}

/**
 * Find all due workflow enrollments for an org and execute the next step.
 * Called by the orchestrator when the 'process_workflow_steps' cron fires.
 */
export async function processWorkflowSteps(orgId: string): Promise<void> {
  const db = getDb(orgId);

  const dueEnrollments = db.prepare(`
    SELECT * FROM workflow_enrollments
    WHERE status = 'active' AND next_send_at <= datetime('now')
  `).all() as WorkflowEnrollment[];

  if (dueEnrollments.length === 0) return;

  console.log(`[Workflows] Processing ${dueEnrollments.length} due enrollment(s) for org ${orgId}`);

  for (const enrollment of dueEnrollments) {
    try {
      // Check goal conditions before executing (uses cached tags)
      if (checkGoalConditions(db, enrollment.workflow_id, enrollment.contact_tags)) {
        db.prepare(
          "UPDATE workflow_enrollments SET status = 'completed', pause_reason = 'goal_met' WHERE id = ?",
        ).run(enrollment.id);
        console.log(`[Workflows] Enrollment ${enrollment.id} completed via goal condition`);
        continue;
      }

      const steps = db.prepare(
        'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order',
      ).all(enrollment.workflow_id) as WorkflowStep[];

      const currentStep = steps[enrollment.current_step];
      if (!currentStep) {
        db.prepare("UPDATE workflow_enrollments SET status = 'completed' WHERE id = ?").run(enrollment.id);
        continue;
      }

      // Build personalization variables from cached contact data
      const vars: Record<string, string> = {
        firstName: enrollment.contact_first_name ?? '',
        lastName: enrollment.contact_last_name ?? '',
        company: enrollment.contact_company ?? '',
        email: enrollment.contact_email,
        fullName: [enrollment.contact_first_name, enrollment.contact_last_name]
          .filter(Boolean).join(' '),
      };

      const stepSucceeded = await executeStep(db, enrollment, currentStep, orgId, vars);
      if (!stepSucceeded) {
        // Leave current_step/next_send_at untouched so the step is retried
        // on the next processing run instead of being silently marked done.
        console.warn(`[Workflows] Step ${enrollment.current_step} failed for enrollment ${enrollment.id}; will retry`);
        continue;
      }

      // Determine the next step index, accounting for branch conditions
      let nextStepIndex = enrollment.current_step + 1;

      if (currentStep.branch_condition) {
        const condition = JSON.parse(currentStep.branch_condition) as BranchCondition;
        const conditionMet = evaluateBranchCondition(db, condition, enrollment);
        const targetStepOrder = conditionMet
          ? condition.true_next_step
          : condition.false_next_step;
        // Find the index of the step with matching step_order
        const targetIndex = steps.findIndex((s) => s.step_order === targetStepOrder);
        nextStepIndex = targetIndex >= 0 ? targetIndex : steps.length; // out-of-bounds → complete
      }

      if (nextStepIndex < steps.length) {
        const nextStep = steps[nextStepIndex];
        const nextSendAt = toSqliteDate(new Date(Date.now() + nextStep.delay_days * 86400000));
        db.prepare(`
          UPDATE workflow_enrollments SET current_step = ?, next_send_at = ? WHERE id = ?
        `).run(nextStepIndex, nextSendAt, enrollment.id);
      } else {
        db.prepare("UPDATE workflow_enrollments SET status = 'completed' WHERE id = ?").run(enrollment.id);
      }
    } catch (err) {
      console.error(`[Workflows] Error processing enrollment ${enrollment.id}:`, err);
    }
  }
}
