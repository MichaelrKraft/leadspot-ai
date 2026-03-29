/**
 * LeadSpot Agent Service - Action Plan Auto-Pause
 *
 * Response detection that auto-pauses drip sequences when prospects reply.
 * Prevents contacts from receiving follow-up messages after they have
 * already engaged, ensuring a natural conversation flow.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../db';
import { getEnrollments, pauseEnrollment, resumeEnrollment } from './index';

// ============================================================================
// Types
// ============================================================================

export interface AutoPauseConfig {
  planId: string;
  organizationId: string;
  enabled: boolean;
  pauseOnEmailReply: boolean;
  pauseOnSmsReply: boolean;
  pauseOnInboundCall: boolean;
  pauseOnCrossChannel: boolean;
  ignoreAutoReplies: boolean;
  resumeRequiresHumanReview: boolean;
  autoResumeAfterHours: number | null;
}

export interface PauseEvent {
  id: string;
  organizationId: string;
  enrollmentId: string;
  planId: string;
  contactId: string;
  triggerEventType: string;
  pausedAt: string;
  resumedAt: string | null;
  resumedBy: string | null;
  autoReplyDetected: boolean;
  status: 'paused' | 'resumed' | 'completed';
}

// ============================================================================
// DB Schema
// ============================================================================

const tablesInitialized = new Set<string>();

function ensureTables(organizationId: string): void {
  if (tablesInitialized.has(organizationId)) return;

  const db = getDb(organizationId);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auto_pause_config (
      plan_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      pause_on_email_reply INTEGER DEFAULT 1,
      pause_on_sms_reply INTEGER DEFAULT 1,
      pause_on_inbound_call INTEGER DEFAULT 1,
      pause_on_cross_channel INTEGER DEFAULT 0,
      ignore_auto_replies INTEGER DEFAULT 1,
      resume_requires_human_review INTEGER DEFAULT 0,
      auto_resume_after_hours REAL
    );

    CREATE TABLE IF NOT EXISTS pause_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      enrollment_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      trigger_event_type TEXT NOT NULL,
      paused_at TEXT NOT NULL,
      resumed_at TEXT,
      resumed_by TEXT,
      auto_reply_detected INTEGER DEFAULT 0,
      status TEXT DEFAULT 'paused'
    );

    CREATE INDEX IF NOT EXISTS idx_pause_events_enrollment
      ON pause_events(enrollment_id);

    CREATE INDEX IF NOT EXISTS idx_pause_events_contact
      ON pause_events(organization_id, contact_id);
  `);

  tablesInitialized.add(organizationId);
}

// ============================================================================
// Row Mapping
// ============================================================================

interface ConfigRow {
  plan_id: string;
  organization_id: string;
  enabled: number;
  pause_on_email_reply: number;
  pause_on_sms_reply: number;
  pause_on_inbound_call: number;
  pause_on_cross_channel: number;
  ignore_auto_replies: number;
  resume_requires_human_review: number;
  auto_resume_after_hours: number | null;
}

interface EventRow {
  id: string;
  organization_id: string;
  enrollment_id: string;
  plan_id: string;
  contact_id: string;
  trigger_event_type: string;
  paused_at: string;
  resumed_at: string | null;
  resumed_by: string | null;
  auto_reply_detected: number;
  status: string;
}

function rowToConfig(row: ConfigRow): AutoPauseConfig {
  return {
    planId: row.plan_id,
    organizationId: row.organization_id,
    enabled: row.enabled === 1,
    pauseOnEmailReply: row.pause_on_email_reply === 1,
    pauseOnSmsReply: row.pause_on_sms_reply === 1,
    pauseOnInboundCall: row.pause_on_inbound_call === 1,
    pauseOnCrossChannel: row.pause_on_cross_channel === 1,
    ignoreAutoReplies: row.ignore_auto_replies === 1,
    resumeRequiresHumanReview: row.resume_requires_human_review === 1,
    autoResumeAfterHours: row.auto_resume_after_hours,
  };
}

function rowToEvent(row: EventRow): PauseEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    enrollmentId: row.enrollment_id,
    planId: row.plan_id,
    contactId: row.contact_id,
    triggerEventType: row.trigger_event_type,
    pausedAt: row.paused_at,
    resumedAt: row.resumed_at,
    resumedBy: row.resumed_by,
    autoReplyDetected: row.auto_reply_detected === 1,
    status: row.status as PauseEvent['status'],
  };
}

function nowISO(): string {
  return new Date().toISOString();
}

// ============================================================================
// Config Management
// ============================================================================

export function getAutoPauseConfig(
  organizationId: string,
  planId: string,
): AutoPauseConfig | undefined {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(
    'SELECT * FROM auto_pause_config WHERE plan_id = ? AND organization_id = ?',
  ).get(planId, organizationId) as ConfigRow | undefined;
  return row ? rowToConfig(row) : undefined;
}

export function setAutoPauseConfig(config: AutoPauseConfig): void {
  ensureTables(config.organizationId);
  const db = getDb(config.organizationId);

  db.prepare(`
    INSERT INTO auto_pause_config
      (plan_id, organization_id, enabled, pause_on_email_reply, pause_on_sms_reply,
       pause_on_inbound_call, pause_on_cross_channel, ignore_auto_replies,
       resume_requires_human_review, auto_resume_after_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(plan_id) DO UPDATE SET
      enabled = excluded.enabled,
      pause_on_email_reply = excluded.pause_on_email_reply,
      pause_on_sms_reply = excluded.pause_on_sms_reply,
      pause_on_inbound_call = excluded.pause_on_inbound_call,
      pause_on_cross_channel = excluded.pause_on_cross_channel,
      ignore_auto_replies = excluded.ignore_auto_replies,
      resume_requires_human_review = excluded.resume_requires_human_review,
      auto_resume_after_hours = excluded.auto_resume_after_hours
  `).run(
    config.planId, config.organizationId, config.enabled ? 1 : 0,
    config.pauseOnEmailReply ? 1 : 0, config.pauseOnSmsReply ? 1 : 0,
    config.pauseOnInboundCall ? 1 : 0, config.pauseOnCrossChannel ? 1 : 0,
    config.ignoreAutoReplies ? 1 : 0, config.resumeRequiresHumanReview ? 1 : 0,
    config.autoResumeAfterHours,
  );
}

// ============================================================================
// Auto-Reply Detection
// ============================================================================

const AUTO_REPLY_KEYWORDS = [
  'out of office',
  'automatic reply',
  'auto-reply',
  'autoreply',
  'on vacation',
  'currently away',
  'away from the office',
  'i am out of',
  'auto response',
  'autoresponse',
  'do not reply',
  'noreply',
];

/**
 * Detects whether a response is an auto-reply based on subject/metadata.
 * Checks for OOO keywords and suspiciously fast response times.
 */
export function isAutoReply(metadata?: Record<string, string>): boolean {
  if (!metadata) return false;

  // Check subject for OOO keywords
  const subject = (metadata['subject'] ?? '').toLowerCase();
  if (AUTO_REPLY_KEYWORDS.some((kw) => subject.includes(kw))) {
    return true;
  }

  // Check if response came in < 60 seconds from last outbound
  const responseDelaySec = metadata['response_delay_seconds'];
  if (responseDelaySec !== undefined) {
    const delay = parseInt(responseDelaySec, 10);
    if (!isNaN(delay) && delay < 60) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Core: Handle Contact Response
// ============================================================================

/**
 * Determines which channel types should trigger a pause for the given event.
 */
function shouldPauseForEvent(
  config: AutoPauseConfig,
  responseEventType: string,
  planStepTypes: string[],
): boolean {
  const isEmailEvent = responseEventType === 'email_reply';
  const isSmsEvent = responseEventType === 'sms_reply';
  const isCallEvent = responseEventType === 'inbound_call';

  // Direct channel match
  if (isEmailEvent && config.pauseOnEmailReply) return true;
  if (isSmsEvent && config.pauseOnSmsReply) return true;
  if (isCallEvent && config.pauseOnInboundCall) return true;

  // Cross-channel: response on a different channel than the plan uses
  if (config.pauseOnCrossChannel) {
    const planHasEmail = planStepTypes.includes('email');
    const planHasSms = planStepTypes.includes('sms');

    if (isEmailEvent && !planHasEmail) return true;
    if (isSmsEvent && !planHasSms) return true;
    if (isCallEvent) return true; // calls are always cross-channel for drips
  }

  return false;
}

/**
 * Handles an inbound response from a contact. Finds all active enrollments,
 * checks auto-pause configs, detects auto-replies, and pauses qualifying
 * enrollments.
 *
 * Returns the list of PauseEvents created.
 */
export function handleContactResponse(
  organizationId: string,
  contactId: string,
  responseEventType: string,
  responseMetadata?: Record<string, string>,
): PauseEvent[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const events: PauseEvent[] = [];

  // Find all active enrollments for this contact
  const activeEnrollments = getEnrollments(organizationId, {
    contactId,
    status: 'active',
  });

  if (activeEnrollments.length === 0) return events;

  const autoReplyDetected = isAutoReply(responseMetadata);

  for (const enrollment of activeEnrollments) {
    const config = getAutoPauseConfig(organizationId, enrollment.planId);
    if (!config || !config.enabled) continue;

    // Skip if auto-reply and config says to ignore them
    if (autoReplyDetected && config.ignoreAutoReplies) continue;

    // Check if already paused for this enrollment
    const existingPause = db.prepare(`
      SELECT id FROM pause_events
      WHERE organization_id = ? AND enrollment_id = ? AND status = 'paused'
    `).get(organizationId, enrollment.id) as { id: string } | undefined;

    if (existingPause) continue; // Don't create duplicate pause

    // Determine plan step types for cross-channel detection
    const planSteps = db.prepare(
      'SELECT steps FROM action_plans WHERE id = ? AND organization_id = ?',
    ).get(enrollment.planId, organizationId) as { steps: string } | undefined;

    const stepTypes: string[] = planSteps
      ? (JSON.parse(planSteps.steps) as Array<{ type: string }>).map((s) => s.type)
      : [];

    if (!shouldPauseForEvent(config, responseEventType, stepTypes)) continue;

    // Pause the enrollment
    const paused = pauseEnrollment(organizationId, enrollment.id);
    if (!paused) continue;

    const pauseEvent: PauseEvent = {
      id: randomUUID(),
      organizationId,
      enrollmentId: enrollment.id,
      planId: enrollment.planId,
      contactId,
      triggerEventType: responseEventType,
      pausedAt: nowISO(),
      resumedAt: null,
      resumedBy: null,
      autoReplyDetected,
      status: 'paused',
    };

    db.prepare(`
      INSERT INTO pause_events
        (id, organization_id, enrollment_id, plan_id, contact_id,
         trigger_event_type, paused_at, resumed_at, resumed_by,
         auto_reply_detected, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pauseEvent.id, organizationId, pauseEvent.enrollmentId,
      pauseEvent.planId, pauseEvent.contactId,
      pauseEvent.triggerEventType, pauseEvent.pausedAt,
      pauseEvent.resumedAt, pauseEvent.resumedBy,
      pauseEvent.autoReplyDetected ? 1 : 0, pauseEvent.status,
    );

    events.push(pauseEvent);
  }

  return events;
}

// ============================================================================
// Resume
// ============================================================================

/**
 * Manually resumes a paused enrollment and updates the pause event.
 */
export function resumeFromPause(
  organizationId: string,
  pauseEventId: string,
  resumedBy: string,
): boolean {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const row = db.prepare(
    `SELECT * FROM pause_events WHERE id = ? AND organization_id = ? AND status = 'paused'`,
  ).get(pauseEventId, organizationId) as EventRow | undefined;

  if (!row) return false;

  const now = nowISO();

  // Resume the enrollment
  const resumed = resumeEnrollment(organizationId, row.enrollment_id);
  if (!resumed) return false;

  db.prepare(`
    UPDATE pause_events SET status = 'resumed', resumed_at = ?, resumed_by = ?
    WHERE id = ? AND organization_id = ?
  `).run(now, resumedBy, pauseEventId, organizationId);

  return true;
}

/**
 * Processes pauses that have exceeded their autoResumeAfterHours threshold.
 * Returns the number of enrollments auto-resumed.
 */
export function processAutoResumes(organizationId: string): number {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const pausedEvents = db.prepare(`
    SELECT pe.*, apc.auto_resume_after_hours, apc.resume_requires_human_review
    FROM pause_events pe
    JOIN auto_pause_config apc ON pe.plan_id = apc.plan_id AND apc.organization_id = pe.organization_id
    WHERE pe.organization_id = ? AND pe.status = 'paused'
      AND apc.auto_resume_after_hours IS NOT NULL
      AND apc.resume_requires_human_review = 0
  `).all(organizationId) as Array<EventRow & { auto_resume_after_hours: number; resume_requires_human_review: number }>;

  let resumed = 0;
  const now = new Date();

  for (const event of pausedEvents) {
    const pausedAt = new Date(event.paused_at);
    const hoursSincePause = (now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSincePause >= event.auto_resume_after_hours) {
      const success = resumeFromPause(organizationId, event.id, 'system:auto-resume');
      if (success) resumed++;
    }
  }

  return resumed;
}

// ============================================================================
// History & Stats
// ============================================================================

export function getPauseEvents(
  organizationId: string,
  filters?: { contactId?: string; planId?: string; status?: PauseEvent['status'] },
): PauseEvent[] {
  ensureTables(organizationId);
  let sql = 'SELECT * FROM pause_events WHERE organization_id = ?';
  const params: (string | number)[] = [organizationId];

  if (filters?.contactId) {
    sql += ' AND contact_id = ?';
    params.push(filters.contactId);
  }
  if (filters?.planId) {
    sql += ' AND plan_id = ?';
    params.push(filters.planId);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY paused_at DESC';

  const rows = getDb(organizationId).prepare(sql).all(...params) as EventRow[];
  return rows.map(rowToEvent);
}

export interface PauseStats {
  totalPauses: number;
  currentlyPaused: number;
  resumed: number;
  autoRepliesIgnored: number;
  avgPauseHours: number;
}

export function getPauseStats(organizationId: string): PauseStats {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM pause_events WHERE organization_id = ?',
  ).get(organizationId) as { count: number };

  const paused = db.prepare(
    `SELECT COUNT(*) as count FROM pause_events WHERE organization_id = ? AND status = 'paused'`,
  ).get(organizationId) as { count: number };

  const resumedCount = db.prepare(
    `SELECT COUNT(*) as count FROM pause_events WHERE organization_id = ? AND status = 'resumed'`,
  ).get(organizationId) as { count: number };

  const autoReplies = db.prepare(
    'SELECT COUNT(*) as count FROM pause_events WHERE organization_id = ? AND auto_reply_detected = 1',
  ).get(organizationId) as { count: number };

  const avgHours = db.prepare(`
    SELECT AVG(
      (julianday(resumed_at) - julianday(paused_at)) * 24
    ) as avg_hours
    FROM pause_events
    WHERE organization_id = ? AND resumed_at IS NOT NULL
  `).get(organizationId) as { avg_hours: number | null };

  return {
    totalPauses: total.count,
    currentlyPaused: paused.count,
    resumed: resumedCount.count,
    autoRepliesIgnored: autoReplies.count,
    avgPauseHours: avgHours.avg_hours ?? 0,
  };
}
