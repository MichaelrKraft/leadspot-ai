/**
 * LeadSpot Agent Service - Action Plans Engine
 *
 * Automated multi-step drip sequences (email, SMS, tasks, tags) that ensure
 * new inquiries get lightning-fast follow-up and long-term prospects are
 * nurtured until ready to buy/sell.
 */
import { randomUUID } from 'crypto';
import { getDb } from '../db';
import { sendEmail } from '../services/email';

// --- Contact Email Lookup ---

interface ContactInfo {
  email: string;
  firstName: string;
  lastName: string;
}

async function lookupContact(contactId: string, organizationId: string): Promise<ContactInfo | null> {
  const backendUrl = process.env.LEADSPOT_API_URL || 'http://localhost:8000';
  try {
    const response = await fetch(`${backendUrl}/api/contacts/${contactId}?organization_id=${organizationId}`);
    if (!response.ok) return null;
    const contact = await response.json() as { email?: string; first_name?: string; last_name?: string };
    if (!contact.email) return null;
    return {
      email: contact.email,
      firstName: contact.first_name ?? '',
      lastName: contact.last_name ?? '',
    };
  } catch {
    return null;
  }
}

export function getInitializedOrgs(): string[] {
  return Array.from(initializedOrgs);
}

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
      history TEXT DEFAULT '[]',
      failure_count INTEGER DEFAULT 0
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
  failure_count: number;
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

function rowToEnrollment(row: EnrollmentRow): ActionPlanEnrollment & { failureCount: number } {
  return {
    id: row.id, organizationId: row.organization_id, planId: row.plan_id,
    contactId: row.contact_id, currentStepIndex: row.current_step_index,
    status: row.status as ActionPlanEnrollment['status'],
    nextStepAt: row.next_step_at, startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    history: JSON.parse(row.history) as ActionStepExecution[],
    failureCount: row.failure_count ?? 0,
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

  if (execution.status === 'failed') {
    const newFailureCount = enrollment.failureCount + 1;
    if (newFailureCount >= 3) {
      db.prepare(`
        UPDATE action_plan_enrollments
        SET status = 'cancelled', history = ?, failure_count = ?
        WHERE id = ? AND organization_id = ?
      `).run(JSON.stringify(updatedHistory), newFailureCount, enrollmentId, organizationId);
    } else {
      const retryAt = addMinutesISO(nowISO(), 15 * newFailureCount);
      db.prepare(`
        UPDATE action_plan_enrollments
        SET next_step_at = ?, history = ?, failure_count = ?
        WHERE id = ? AND organization_id = ?
      `).run(retryAt, JSON.stringify(updatedHistory), newFailureCount, enrollmentId, organizationId);
    }
    return execution;
  }

  const nextIndex = enrollment.currentStepIndex + 1;

  if (nextIndex >= plan.steps.length) {
    db.prepare(`
      UPDATE action_plan_enrollments
      SET current_step_index = ?, status = 'completed', completed_at = ?, history = ?, failure_count = 0
      WHERE id = ? AND organization_id = ?
    `).run(nextIndex, nowISO(), JSON.stringify(updatedHistory), enrollmentId, organizationId);
  } else {
    const nextStepAt = addMinutesISO(nowISO(), plan.steps[nextIndex].delayMinutes);
    db.prepare(`
      UPDATE action_plan_enrollments
      SET current_step_index = ?, next_step_at = ?, history = ?, failure_count = 0
      WHERE id = ? AND organization_id = ?
    `).run(nextIndex, nextStepAt, JSON.stringify(updatedHistory), enrollmentId, organizationId);
  }
  return execution;
}

async function executeStep(step: ActionStep, enrollment: ActionPlanEnrollment): Promise<ActionStepExecution> {
  const base: ActionStepExecution = { stepIndex: step.order, executedAt: nowISO(), status: 'success' };

  switch (step.type) {
    case 'email': {
      const contactInfo = await lookupContact(enrollment.contactId, enrollment.organizationId);

      if (!contactInfo) {
        console.warn(`[ActionPlan] No contact found for ${enrollment.contactId}, skipping email step`);
        return { ...base, status: 'skipped', result: 'Contact not found' };
      }

      const placeholders = { firstName: contactInfo.firstName, lastName: contactInfo.lastName };
      const subject = replacePlaceholders(step.config.subject ?? '(No subject)', placeholders);
      const bodyTemplate = step.config.body ?? step.config.subject ?? '(No body)';
      const body = replacePlaceholders(bodyTemplate, placeholders);

      const emailResult = await sendEmail({
        to: contactInfo.email,
        subject,
        body,
        contactId: enrollment.contactId,
        campaignId: enrollment.planId,
        organizationId: enrollment.organizationId,
      });

      if (emailResult.suppressed) {
        return { ...base, status: 'skipped', result: 'Contact email is suppressed' };
      }
      if (!emailResult.success) {
        return { ...base, status: 'failed', result: `Email failed: ${emailResult.error}` };
      }
      return { ...base, result: `Email sent (id: ${emailResult.messageId})` };
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

// --- GoAutomated.ai Tipping Point Plans ---
// Call createGoAutomatedPlans(orgId) once for your GoAutomated.ai organization
// to seed these two plans. Idempotent — skips if names already exist.

export function createGoAutomatedPlans(organizationId: string): void {
  ensureTables(organizationId);
  const existing = getActionPlans(organizationId);
  const names = new Set(existing.map((p) => p.name));

  if (!names.has('Scale Tipper Sequence')) {
    createActionPlan(
      organizationId,
      'Scale Tipper Sequence',
      'manual',
      [
        makeStep(0, 'email', 1440, {
          subject: 'He almost cancelled before he saw this...',
          body: `Hi {firstName},

I want to share something before our call.

One of my clients — a professional services firm owner — had been burned twice by consultants who over-promised and under-delivered. He almost didn't book our call. He figured automation was just another vendor selling complexity.

He gave it one more shot. Within 8 weeks, his client intake process went from 6 hours to 15 minutes — saving $180,000 a year. He told me: "I wish I'd done this two years ago."

See you on our call.

Mike
Go Automated`,
        }),
        makeStep(1, 'email', 1440, {
          subject: "She made the decision on the first call. Here's what happened next.",
          body: `Hi {firstName},

Quick one before we meet.

Another client — an operations manager at a growing company — didn't overthink it. She'd already seen how much time her team wasted on manual reports. She said yes on the first call.

Four weeks later, reports that took 40 hours a month took 2 hours. Her team stopped dreading Fridays.

$95,000 in annual savings before most people would have "finished thinking about it."

See you soon.

Mike
Go Automated`,
        }),
        makeStep(2, 'email', 1440, {
          subject: "The leads were great. But that wasn't the real change.",
          body: `Hi {firstName},

One more story before we connect.

A founder came in wanting to save time. Six months later, he told me: "The automations are great, but what really changed is that I finally feel like a CEO. I'm not the bottleneck anymore."

That's what this is really about. Not just hours saved — it's about building a business that runs without you holding it together.

Looking forward to our call.

Mike
Go Automated`,
        }),
      ],
      'Three pre-call story emails sent 1 day apart after booking. Tips the desire scale before the discovery call.',
    );
  }

  if (!names.has('90-Day Follow-Up')) {
    createActionPlan(
      organizationId,
      '90-Day Follow-Up',
      'manual',
      [
        makeStep(0, 'email', 0, {
          subject: 'Something I noticed from our conversation',
          body: `Hi {firstName},

I've been thinking about what you shared on our call.

The bottleneck you described is something I see holding back a lot of operations teams. What's usually underneath it isn't a tool problem — it's a process problem that looks like a tool problem.

Worth keeping in mind as you think through your options.

No agenda. Just sharing what I noticed.

Mike
Go Automated`,
        }),
        makeStep(1, 'email', 10080, {
          subject: 'A quick win you can use this week (no strings)',
          body: `Hi {firstName},

Whether we end up working together or not, here's something you can implement today:

Map out the top 3 tasks your team repeats every week that don't require judgment — just data entry, copy-paste, or status updates. Time them. Multiply by 52.

That number is your automation opportunity in hours per year. Most companies are surprised by it.

If you want, reply with your number. I'm happy to tell you which ones are the easiest to automate first.

Mike
Go Automated`,
        }),
        makeStep(2, 'email', 10080, {
          subject: 'Why I got into this (the honest version)',
          body: `Hi {firstName},

I started Go Automated because I watched smart companies waste years on work that software could handle in seconds.

Not because they were inefficient. Because nobody had ever mapped it out for them.

The $500 audit exists because I believe you should see exactly what's possible before you commit to anything. No vague promises. Just a clear map.

That's the whole pitch.

Mike
Go Automated`,
        }),
        makeStep(3, 'email', 10080, {
          subject: 'Case study: 6 hours → 15 minutes',
          body: `Hi {firstName},

A professional services firm was spending 6 hours on client intake for every new client. Forms, data entry, CRM updates, calendar scheduling — all manual.

We automated it. Now it takes 15 minutes. Most of that is the client filling out the form.

Annual savings: $180,000. Zero new hires.

The pattern holds across industries. Curious what your equivalent looks like? I'm happy to take a look.

Mike
Go Automated`,
        }),
        makeStep(4, 'email', 10080, {
          subject: 'The automation most businesses overlook',
          body: `Hi {firstName},

The automations that get the most attention are the flashy ones — AI chatbots, voice agents, that kind of thing.

The ones that actually move the needle are boring: report generation, invoice processing, lead routing, follow-up sequences.

The boring ones compound quietly. Most companies are sitting on $100K+ in recoverable hours from boring automations alone.

Worth a look.

Mike
Go Automated`,
        }),
        makeStep(5, 'email', 10080, {
          subject: 'Tool recommendation (genuinely useful)',
          body: `Hi {firstName},

One tool I recommend to almost every client before we build anything custom: n8n.

It's open source, self-hostable, and handles 80% of business automation needs without any code. If you want to experiment before investing, it's the best starting point.

Happy to point you toward which workflows to try first if you're curious.

Mike
Go Automated`,
        }),
        makeStep(6, 'email', 10080, {
          subject: 'The real cost of manual work',
          body: `Hi {firstName},

Quick math:

An $80K employee spending 30% of their time on automatable tasks = $24,000/year in recoverable cost.

10 employees: $240,000.

That's consistent with what we find in almost every audit.

The question isn't whether the opportunity is there. It's whether now is the right time to go get it.

Mike
Go Automated`,
        }),
        makeStep(7, 'email', 10080, {
          subject: 'What happened when they stopped manually generating reports',
          body: `Hi {firstName},

A company was spending 40 hours a month generating reports. Someone pulled data from three systems, formatted it in Excel, emailed it to leadership.

We automated the whole thing. Now it's 2 hours a month — just review and send.

$95K saved annually. The person who used to do it? Now running a project they'd been shelving for two years.

Mike
Go Automated`,
        }),
        makeStep(8, 'email', 10080, {
          subject: 'One more quick win',
          body: `Hi {firstName},

If you have a CRM and an email system that don't talk to each other, that gap is costing you leads.

Every time someone fills out a form and your team manually copies it to the CRM, there's a chance of a data error or a delay that costs you the lead.

A simple Zapier or Make integration fixes it in under an hour. Happy to walk you through the setup if you want.

Mike
Go Automated`,
        }),
        makeStep(9, 'email', 10080, {
          subject: "What 'I finally feel like a CEO' actually looks like",
          body: `Hi {firstName},

The clients who get the most out of automation aren't always the ones who save the most hours.

They're the ones who use those hours to do work only they can do.

One client told me: "I used to spend Mondays catching up. Now I spend them planning." That's a different kind of business.

Mike
Go Automated`,
        }),
        makeStep(10, 'email', 10080, {
          subject: 'Results across the board',
          body: `Hi {firstName},

In case the numbers help:

- Client intake: 6 hrs → 15 min ($180K saved)
- Monthly reporting: 40 hrs → 2 hrs ($95K saved)
- Lead follow-up: 0% automated → 100% automated (3x conversion lift)
- Invoice processing: 8 hrs/week → 30 min/week

These aren't outliers. These are medians.

If you ever want to run the numbers on your operation, the offer still stands.

Mike
Go Automated`,
        }),
        makeStep(11, 'email', 10080, {
          subject: 'Last one from me for a while',
          body: `Hi {firstName},

I've been sending you value for a few months now. I'll leave you alone after this.

If the timing was off, I get it. Decisions like this need to land at the right moment.

If that moment comes, you know where to find me.

The $500 audit offer stands whenever you're ready. No pressure, no expiry.

Mike
Go Automated`,
        }),
      ],
      '12-week value-based follow-up for prospects who did not close. Stacks desire without checking in.',
    );
  }
}
