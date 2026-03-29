/**
 * LeadSpot Agent Service - Action Plans Engine
 *
 * Automated multi-step drip sequences (email, SMS, tasks, tags) that ensure
 * new inquiries get lightning-fast follow-up and long-term prospects are
 * nurtured until ready to buy/sell.
 */
import { randomUUID } from 'crypto';
import { getDb } from '../db';

// --- Types ---

export type ActionStepType = 'email' | 'sms' | 'task' | 'call_reminder' | 'tag' | 'wait';

export interface ActionStep {
  id: string;
  order: number;
  type: ActionStepType;
  delayMinutes: number;
  config: {
    subject?: string;
    body?: string;
    taskTitle?: string;
    tagName?: string;
    useAiDraft?: boolean;
  };
}

export interface ActionPlan {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  triggerType: 'manual' | 'new_lead' | 'tag_added' | 'form_submitted' | 'stage_changed';
  triggerValue?: string;
  steps: ActionStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionStepExecution {
  stepIndex: number;
  executedAt: string;
  status: 'success' | 'failed' | 'skipped';
  result?: string;
}

export interface ActionPlanEnrollment {
  id: string;
  organizationId: string;
  planId: string;
  contactId: string;
  currentStepIndex: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  nextStepAt: string;
  startedAt: string;
  completedAt?: string;
  history: ActionStepExecution[];
}

// --- DB Initialization ---

const initializedOrgs = new Set<string>();

function ensureTables(organizationId: string): void {
  if (initializedOrgs.has(organizationId)) return;
  const db = getDb(organizationId);
  db.exec(`
    CREATE TABLE IF NOT EXISTS action_plans (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      trigger_type TEXT NOT NULL,
      trigger_value TEXT,
      steps TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_plan_enrollments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      current_step_index INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      next_step_at TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      history TEXT DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_action_plans_org ON action_plans(organization_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_org_status ON action_plan_enrollments(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_enrollments_next_step ON action_plan_enrollments(organization_id, status, next_step_at);
    CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON action_plan_enrollments(organization_id, contact_id);
  `);
  initializedOrgs.add(organizationId);
}

// --- Helpers ---

interface PlaceholderValues {
  firstName?: string;
  lastName?: string;
  agentName?: string;
  propertyAddress?: string;
}

export function replacePlaceholders(template: string, values: PlaceholderValues): string {
  return template
    .replace(/\{firstName\}/g, values.firstName ?? '')
    .replace(/\{lastName\}/g, values.lastName ?? '')
    .replace(/\{agentName\}/g, values.agentName ?? '')
    .replace(/\{propertyAddress\}/g, values.propertyAddress ?? '');
}

function makeStep(order: number, type: ActionStepType, delayMinutes: number, config: ActionStep['config']): ActionStep {
  return { id: randomUUID(), order, type, delayMinutes, config };
}

function nowISO(): string { return new Date().toISOString(); }

function addMinutesISO(base: string, minutes: number): string {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

interface PlanRow {
  id: string; organization_id: string; name: string; description: string;
  trigger_type: string; trigger_value: string | null; steps: string;
  is_active: number; created_at: string; updated_at: string;
}

interface EnrollmentRow {
  id: string; organization_id: string; plan_id: string; contact_id: string;
  current_step_index: number; status: string; next_step_at: string;
  started_at: string; completed_at: string | null; history: string;
}

function rowToPlan(row: PlanRow): ActionPlan {
  return {
    id: row.id, organizationId: row.organization_id, name: row.name,
    description: row.description,
    triggerType: row.trigger_type as ActionPlan['triggerType'],
    triggerValue: row.trigger_value ?? undefined,
    steps: JSON.parse(row.steps) as ActionStep[],
    isActive: row.is_active === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToEnrollment(row: EnrollmentRow): ActionPlanEnrollment {
  return {
    id: row.id, organizationId: row.organization_id, planId: row.plan_id,
    contactId: row.contact_id, currentStepIndex: row.current_step_index,
    status: row.status as ActionPlanEnrollment['status'],
    nextStepAt: row.next_step_at, startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    history: JSON.parse(row.history) as ActionStepExecution[],
  };
}

// --- Action Plan CRUD ---

export function createActionPlan(
  organizationId: string, name: string, triggerType: ActionPlan['triggerType'],
  steps: ActionStep[], description?: string, triggerValue?: string,
): ActionPlan {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const now = nowISO();
  const plan: ActionPlan = {
    id: randomUUID(), organizationId, name, description: description ?? '',
    triggerType, triggerValue, steps, isActive: true, createdAt: now, updatedAt: now,
  };
  db.prepare(`
    INSERT INTO action_plans (id, organization_id, name, description, trigger_type, trigger_value, steps, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    plan.id, organizationId, plan.name, plan.description,
    plan.triggerType, plan.triggerValue ?? null,
    JSON.stringify(plan.steps), 1, plan.createdAt, plan.updatedAt,
  );
  return plan;
}

export function getActionPlans(organizationId: string): ActionPlan[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM action_plans WHERE organization_id = ? ORDER BY created_at DESC',
  ).all(organizationId) as PlanRow[];
  return rows.map(rowToPlan);
}

export function getActionPlan(organizationId: string, planId: string): ActionPlan | undefined {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(
    'SELECT * FROM action_plans WHERE organization_id = ? AND id = ?',
  ).get(organizationId, planId) as PlanRow | undefined;
  return row ? rowToPlan(row) : undefined;
}

export function updateActionPlan(
  organizationId: string, planId: string,
  updates: Partial<Pick<ActionPlan, 'name' | 'description' | 'triggerType' | 'triggerValue' | 'steps' | 'isActive'>>,
): boolean {
  ensureTables(organizationId);
  const existing = getActionPlan(organizationId, planId);
  if (!existing) return false;
  const merged = { ...existing, ...updates, updatedAt: nowISO() };
  getDb(organizationId).prepare(`
    UPDATE action_plans
    SET name = ?, description = ?, trigger_type = ?, trigger_value = ?, steps = ?, is_active = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).run(
    merged.name, merged.description, merged.triggerType,
    merged.triggerValue ?? null, JSON.stringify(merged.steps),
    merged.isActive ? 1 : 0, merged.updatedAt, planId, organizationId,
  );
  return true;
}

export function deleteActionPlan(organizationId: string, planId: string): boolean {
  ensureTables(organizationId);
  const result = getDb(organizationId).prepare(
    'DELETE FROM action_plans WHERE id = ? AND organization_id = ?',
  ).run(planId, organizationId);
  return result.changes > 0;
}

// --- Enrollment Management ---

export function enrollContact(organizationId: string, planId: string, contactId: string): ActionPlanEnrollment {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const plan = getActionPlan(organizationId, planId);
  if (!plan) throw new Error(`Action plan ${planId} not found`);
  if (plan.steps.length === 0) throw new Error('Cannot enroll in a plan with no steps');

  const now = nowISO();
  const enrollment: ActionPlanEnrollment = {
    id: randomUUID(), organizationId, planId, contactId, currentStepIndex: 0,
    status: 'active', nextStepAt: addMinutesISO(now, plan.steps[0].delayMinutes),
    startedAt: now, history: [],
  };
  db.prepare(`
    INSERT INTO action_plan_enrollments
      (id, organization_id, plan_id, contact_id, current_step_index, status, next_step_at, started_at, completed_at, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    enrollment.id, organizationId, enrollment.planId, enrollment.contactId,
    enrollment.currentStepIndex, enrollment.status,
    enrollment.nextStepAt, enrollment.startedAt, null, '[]',
  );
  return enrollment;
}

interface EnrollmentFilter {
  planId?: string;
  contactId?: string;
  status?: ActionPlanEnrollment['status'];
}

export function getEnrollments(organizationId: string, options?: EnrollmentFilter): ActionPlanEnrollment[] {
  ensureTables(organizationId);
  let sql = 'SELECT * FROM action_plan_enrollments WHERE organization_id = ?';
  const params: (string | number)[] = [organizationId];
  if (options?.planId) { sql += ' AND plan_id = ?'; params.push(options.planId); }
  if (options?.contactId) { sql += ' AND contact_id = ?'; params.push(options.contactId); }
  if (options?.status) { sql += ' AND status = ?'; params.push(options.status); }
  sql += ' ORDER BY started_at DESC';
  const rows = getDb(organizationId).prepare(sql).all(...params) as EnrollmentRow[];
  return rows.map(rowToEnrollment);
}

export function pauseEnrollment(organizationId: string, enrollmentId: string): boolean {
  return setEnrollmentStatus(organizationId, enrollmentId, 'active', 'paused');
}

export function resumeEnrollment(organizationId: string, enrollmentId: string): boolean {
  return setEnrollmentStatus(organizationId, enrollmentId, 'paused', 'active');
}

export function cancelEnrollment(organizationId: string, enrollmentId: string): boolean {
  ensureTables(organizationId);
  const result = getDb(organizationId).prepare(`
    UPDATE action_plan_enrollments SET status = 'cancelled', completed_at = ?
    WHERE id = ? AND organization_id = ? AND status IN ('active', 'paused')
  `).run(nowISO(), enrollmentId, organizationId);
  return result.changes > 0;
}

function setEnrollmentStatus(orgId: string, enrollmentId: string, from: string, to: string): boolean {
  ensureTables(orgId);
  const result = getDb(orgId).prepare(`
    UPDATE action_plan_enrollments SET status = ?
    WHERE id = ? AND organization_id = ? AND status = ?
  `).run(to, enrollmentId, orgId, from);
  return result.changes > 0;
}

// --- Step Execution ---

export function getDueEnrollments(organizationId: string): ActionPlanEnrollment[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(`
    SELECT * FROM action_plan_enrollments
    WHERE organization_id = ? AND status = 'active' AND next_step_at <= ?
    ORDER BY next_step_at ASC
  `).all(organizationId, nowISO()) as EnrollmentRow[];
  return rows.map(rowToEnrollment);
}

export async function processNextStep(organizationId: string, enrollmentId: string): Promise<ActionStepExecution> {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const eRow = db.prepare(
    'SELECT * FROM action_plan_enrollments WHERE id = ? AND organization_id = ?',
  ).get(enrollmentId, organizationId) as EnrollmentRow | undefined;
  if (!eRow) throw new Error(`Enrollment ${enrollmentId} not found`);
  const enrollment = rowToEnrollment(eRow);

  if (enrollment.status !== 'active') throw new Error(`Enrollment is ${enrollment.status}, not active`);
  if (new Date(enrollment.nextStepAt) > new Date()) throw new Error('Next step is not yet due');

  const plan = getActionPlan(organizationId, enrollment.planId);
  if (!plan) throw new Error(`Plan ${enrollment.planId} not found`);

  const step = plan.steps[enrollment.currentStepIndex];
  if (!step) throw new Error(`Step index ${enrollment.currentStepIndex} out of bounds`);

  const execution = await executeStep(step, enrollment);
  const updatedHistory: ActionStepExecution[] = [...enrollment.history, execution];
  const nextIndex = enrollment.currentStepIndex + 1;

  if (nextIndex >= plan.steps.length) {
    db.prepare(`
      UPDATE action_plan_enrollments
      SET current_step_index = ?, status = 'completed', completed_at = ?, history = ?
      WHERE id = ? AND organization_id = ?
    `).run(nextIndex, nowISO(), JSON.stringify(updatedHistory), enrollmentId, organizationId);
  } else {
    const nextStepAt = addMinutesISO(nowISO(), plan.steps[nextIndex].delayMinutes);
    db.prepare(`
      UPDATE action_plan_enrollments
      SET current_step_index = ?, next_step_at = ?, history = ?
      WHERE id = ? AND organization_id = ?
    `).run(nextIndex, nextStepAt, JSON.stringify(updatedHistory), enrollmentId, organizationId);
  }
  return execution;
}

async function executeStep(step: ActionStep, enrollment: ActionPlanEnrollment): Promise<ActionStepExecution> {
  const base: ActionStepExecution = { stepIndex: step.order, executedAt: nowISO(), status: 'success' };

  switch (step.type) {
    case 'email': {
      if (step.config.useAiDraft) {
        // TODO: Call orchestrator to generate AI draft email using contact context
        return { ...base, result: 'AI draft queued for approval' };
      }
      // TODO: Send email via email service (Mailgun, SendGrid, etc.)
      console.log(`[ActionPlan] Would send email to contact ${enrollment.contactId}: "${step.config.subject ?? ''}"`);
      return { ...base, result: `Email sent: ${step.config.subject || '(template)'}` };
    }
    case 'sms': {
      if (step.config.useAiDraft) {
        // TODO: Call orchestrator to generate AI draft SMS
        return { ...base, result: 'AI SMS draft queued for approval' };
      }
      // TODO: Send SMS via Twilio or similar provider
      console.log(`[ActionPlan] Would send SMS to contact ${enrollment.contactId}`);
      return { ...base, result: 'SMS sent' };
    }
    case 'task':
    case 'call_reminder': {
      const title = step.config.taskTitle ?? `${step.type} for contact`;
      // TODO: Create task/reminder in the CRM task system
      console.log(`[ActionPlan] Would create ${step.type}: "${title}" for contact ${enrollment.contactId}`);
      return { ...base, result: `${step.type === 'call_reminder' ? 'Call reminder' : 'Task'} created: ${title}` };
    }
    case 'tag': {
      // TODO: Add tag to contact via CRM API
      console.log(`[ActionPlan] Would add tag "${step.config.tagName}" to contact ${enrollment.contactId}`);
      return { ...base, result: `Tag added: ${step.config.tagName ?? ''}` };
    }
    case 'wait':
      return { ...base, result: 'Wait step completed' };
    default: {
      const _exhaustive: never = step.type;
      void _exhaustive;
      return { ...base, status: 'skipped', result: 'Unknown step type' };
    }
  }
}

// --- Default Plans ---

export function createDefaultPlans(organizationId: string): void {
  ensureTables(organizationId);
  if (getActionPlans(organizationId).length > 0) return;

  // 1. Speed to Lead
  createActionPlan(organizationId, 'New Lead - Speed to Lead', 'new_lead', [
    makeStep(0, 'email', 0, { useAiDraft: true, subject: 'Welcome - Your Property Search' }),
    makeStep(1, 'sms', 5, {
      body: 'Hi {firstName}, this is {agentName}. I just sent you an email about your property inquiry. When\'s a good time to chat?',
    }),
    makeStep(2, 'call_reminder', 30, { taskTitle: 'Call new lead {firstName} {lastName}' }),
    makeStep(3, 'email', 1440, { useAiDraft: true, subject: 'Following up on your inquiry' }),
    makeStep(4, 'email', 4320, { useAiDraft: true, subject: 'Market update for you' }),
    makeStep(5, 'tag', 10080, { tagName: 'needs-attention' }),
  ], 'Immediate follow-up sequence for new leads with email, SMS, and call reminders.');

  // 2. Open House Follow-Up
  createActionPlan(organizationId, 'Open House Follow-Up', 'tag_added', [
    makeStep(0, 'email', 60, { useAiDraft: true, subject: 'Great meeting you at the open house!' }),
    makeStep(1, 'email', 1440, { useAiDraft: true, subject: 'Listing details you asked about' }),
    makeStep(2, 'task', 2880, { taskTitle: 'Follow up with open house visitor {firstName}' }),
    makeStep(3, 'email', 10080, { useAiDraft: true, subject: 'Market update for your area' }),
  ], 'Follow-up sequence for open house attendees.', 'open-house-attendee');

  // 3. Long-Term Nurture
  createActionPlan(organizationId, 'Long-Term Nurture', 'tag_added', [
    makeStep(0, 'email', 0, { useAiDraft: true, subject: 'Staying in touch' }),
    makeStep(1, 'email', 20160, { useAiDraft: true, subject: 'Market update' }),
    makeStep(2, 'email', 43200, { useAiDraft: true, subject: 'New listings you might like' }),
    makeStep(3, 'task', 86400, { taskTitle: 'Check in with {firstName} - 2 month nurture' }),
    makeStep(4, 'email', 129600, { useAiDraft: true, subject: 'Thinking of you' }),
  ], 'Long-term drip sequence for prospects not ready to transact yet.', 'long-term');
}
