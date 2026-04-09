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

// ============================================================================
// Helpers
// ============================================================================

/** Convert Date to SQLite datetime string (UTC, space separator) */
function toSqliteDate(d: Date): string {
  return d.toISOString().replace('T', ' ').substring(0, 19);
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
  steps: Array<{ delayDays: number; subject: string; body: string }>,
): Workflow {
  const id = randomUUID();
  db.prepare('INSERT INTO workflows (id, name) VALUES (?, ?)').run(id, name);

  const insertStep = db.prepare(
    'INSERT INTO workflow_steps (id, workflow_id, step_order, delay_days, subject, body) VALUES (?, ?, ?, ?, ?, ?)',
  );
  steps.forEach((step, index) => {
    insertStep.run(randomUUID(), id, index, step.delayDays, step.subject, step.body);
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

// ============================================================================
// Enrollment
// ============================================================================

export async function enrollContacts(
  db: Database.Database,
  workflowId: string,
  orgId: string,
  contacts: Array<{ id: string; email: string }>,
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
    INSERT INTO workflow_enrollments (id, workflow_id, contact_id, contact_email, current_step, status, next_send_at)
    VALUES (?, ?, ?, ?, 0, 'active', ?)
  `);

  for (const contact of contacts) {
    // Skip if already actively enrolled
    const existing = db.prepare(
      "SELECT id FROM workflow_enrollments WHERE workflow_id = ? AND contact_id = ? AND status = 'active'",
    ).get(workflowId, contact.id);
    if (existing) continue;

    insertEnrollment.run(randomUUID(), workflowId, contact.id, contact.email, nextSendAt);
  }

  // Ensure a recurring cron job exists for this org to process workflow steps.
  // addJob uses UNIQUE(org, name) — duplicate calls are silently ignored.
  const cronService = createCronService();
  await cronService.addJob(
    'process_workflow_steps',
    { kind: 'every', everyMs: 5 * 60 * 1000 }, // every 5 minutes
    { message: 'Process due workflow email steps', action: 'process_workflow_steps' },
    orgId,
    { enabled: true },
  );

  // Ensure the cron service is running for this org
  if (!cronService.isRunning()) {
    await cronService.startForOrg(orgId);
  }
}

// ============================================================================
// Execution
// ============================================================================

/**
 * Find all due workflow enrollments for an org and send the next email step.
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

  const { sendEmail } = await import('../services/email');

  for (const enrollment of dueEnrollments) {
    try {
      const steps = db.prepare(
        'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order',
      ).all(enrollment.workflow_id) as WorkflowStep[];

      const currentStep = steps[enrollment.current_step];
      if (!currentStep) {
        db.prepare("UPDATE workflow_enrollments SET status = 'completed' WHERE id = ?").run(enrollment.id);
        continue;
      }

      await sendEmail({
        to: enrollment.contact_email,
        subject: currentStep.subject,
        body: currentStep.body,
        contactId: enrollment.contact_id,
        organizationId: orgId,
      });

      const nextStepIndex = enrollment.current_step + 1;

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
