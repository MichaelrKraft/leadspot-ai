/**
 * LeadSpot Agent Service - Contact Timeline
 *
 * Unified chronological activity feed per contact. Every interaction --
 * calls, emails, texts, notes, AI suggestions, voice commands -- is logged
 * here as a single omnichannel view (modeled after FUB's activity stream).
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { getDb } from '../db';

// ============================================================================
// Types
// ============================================================================

export type TimelineEventType =
  | 'call_inbound'
  | 'call_outbound'
  | 'email_sent'
  | 'email_received'
  | 'email_opened'
  | 'sms_sent'
  | 'sms_received'
  | 'note_added'
  | 'tag_added'
  | 'tag_removed'
  | 'stage_changed'
  | 'score_changed'
  | 'form_submitted'
  | 'page_visited'
  | 'ai_suggestion'
  | 'ai_draft_approved'
  | 'appointment_booked'
  | 'appointment_completed'
  | 'action_plan_step'
  | 'voice_command';

export interface TimelineEvent {
  id: string;
  organizationId: string;
  contactId: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  metadata?: Record<string, string>;
  source: 'human' | 'ai' | 'system' | 'automation';
  createdAt: string;
  createdBy?: string;
}

export interface TimelineSummary {
  contactId: string;
  totalInteractions: number;
  lastContactDate: string;
  daysSinceLastContact: number;
  channelBreakdown: Record<string, number>;
  aiSummary: string;
}

export interface TimelineQueryOptions {
  limit?: number;
  offset?: number;
  types?: TimelineEventType[];
}

// ============================================================================
// DB Row Type
// ============================================================================

interface TimelineRow {
  id: string;
  organization_id: string;
  contact_id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: string | null;
  source: string;
  created_at: string;
  created_by: string | null;
}

// ============================================================================
// Schema
// ============================================================================

const TABLES_INITIALIZED = new Set<string>();

function ensureTables(organizationId: string): void {
  if (TABLES_INITIALIZED.has(organizationId)) return;
  const db = getDb(organizationId);

  db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      contact_id        TEXT NOT NULL,
      type              TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      metadata          TEXT,
      source            TEXT NOT NULL DEFAULT 'human',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      created_by        TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_contact
      ON timeline_events(organization_id, contact_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_timeline_recent
      ON timeline_events(organization_id, created_at DESC);
  `);

  TABLES_INITIALIZED.add(organizationId);
}

// ============================================================================
// Claude Client
// ============================================================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// ============================================================================
// Channel Mapping
// ============================================================================

/** Map event types to high-level channel names for the breakdown. */
function eventTypeToChannel(type: TimelineEventType): string {
  switch (type) {
    case 'call_inbound':
    case 'call_outbound':
      return 'call';
    case 'email_sent':
    case 'email_received':
    case 'email_opened':
      return 'email';
    case 'sms_sent':
    case 'sms_received':
      return 'sms';
    case 'note_added':
      return 'note';
    case 'tag_added':
    case 'tag_removed':
      return 'tag';
    case 'stage_changed':
    case 'score_changed':
      return 'status';
    case 'form_submitted':
    case 'page_visited':
      return 'web';
    case 'ai_suggestion':
    case 'ai_draft_approved':
      return 'ai';
    case 'appointment_booked':
    case 'appointment_completed':
      return 'appointment';
    case 'action_plan_step':
      return 'action_plan';
    case 'voice_command':
      return 'voice';
  }
}

/** Event types that count as outbound agent contact (for speed-to-lead). */
const OUTBOUND_TYPES: ReadonlySet<TimelineEventType> = new Set([
  'call_outbound',
  'email_sent',
  'sms_sent',
]);

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Log a new timeline event for a contact.
 */
export function logEvent(
  event: Omit<TimelineEvent, 'id' | 'createdAt'>
): TimelineEvent {
  ensureTables(event.organizationId);
  const db = getDb(event.organizationId);

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO timeline_events (id, organization_id, contact_id, type, title, description, metadata, source, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    event.organizationId,
    event.contactId,
    event.type,
    event.title,
    event.description ?? null,
    event.metadata ? JSON.stringify(event.metadata) : null,
    event.source,
    createdAt,
    event.createdBy ?? null
  );

  return { ...event, id, createdAt };
}

/**
 * Get the timeline for a specific contact, with optional type filtering.
 */
export function getTimeline(
  organizationId: string,
  contactId: string,
  options: TimelineQueryOptions = {}
): TimelineEvent[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let sql = `SELECT * FROM timeline_events WHERE organization_id = ? AND contact_id = ?`;
  const params: (string | number)[] = [organizationId, contactId];

  if (options.types && options.types.length > 0) {
    const placeholders = options.types.map(() => '?').join(', ');
    sql += ` AND type IN (${placeholders})`;
    params.push(...options.types);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params) as TimelineRow[];
  return rows.map(rowToEvent);
}

/**
 * Get an AI-generated summary of a contact's timeline.
 */
export async function getTimelineSummary(
  organizationId: string,
  contactId: string
): Promise<TimelineSummary> {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  // Gather stats
  const countRow = db
    .prepare(
      `SELECT COUNT(*) as total FROM timeline_events
       WHERE organization_id = ? AND contact_id = ?`
    )
    .get(organizationId, contactId) as { total: number } | undefined;

  const totalInteractions = countRow?.total ?? 0;

  const lastRow = db
    .prepare(
      `SELECT created_at FROM timeline_events
       WHERE organization_id = ? AND contact_id = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(organizationId, contactId) as { created_at: string } | undefined;

  const lastContactDate = lastRow?.created_at ?? '';
  const daysSinceLastContact = lastContactDate
    ? daysBetween(new Date(lastContactDate), new Date())
    : 0;

  // Channel breakdown
  const channelRows = db
    .prepare(
      `SELECT type, COUNT(*) as cnt FROM timeline_events
       WHERE organization_id = ? AND contact_id = ?
       GROUP BY type`
    )
    .all(organizationId, contactId) as { type: string; cnt: number }[];

  const channelBreakdown: Record<string, number> = {};
  for (const row of channelRows) {
    const channel = eventTypeToChannel(row.type as TimelineEventType);
    channelBreakdown[channel] = (channelBreakdown[channel] ?? 0) + row.cnt;
  }

  // Get recent events for AI summary
  const recentEvents = getTimeline(organizationId, contactId, { limit: 30 });
  const aiSummary = await generateAiSummary(recentEvents, totalInteractions, daysSinceLastContact);

  return {
    contactId,
    totalInteractions,
    lastContactDate,
    daysSinceLastContact,
    channelBreakdown,
    aiSummary,
  };
}

/**
 * Get recent activity across all contacts for the dashboard feed.
 */
export function getRecentActivity(
  organizationId: string,
  limit: number = 25
): TimelineEvent[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const rows = db
    .prepare(
      `SELECT * FROM timeline_events
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(organizationId, limit) as TimelineRow[];

  return rows.map(rowToEvent);
}

/**
 * Calculate speed-to-lead: minutes between the first event for a contact
 * and the first outbound contact (call, email, or SMS).
 * Returns null if no outbound event exists yet.
 */
export function getSpeedToLead(
  organizationId: string,
  contactId: string
): number | null {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  // First event (creation proxy)
  const firstRow = db
    .prepare(
      `SELECT created_at FROM timeline_events
       WHERE organization_id = ? AND contact_id = ?
       ORDER BY created_at ASC LIMIT 1`
    )
    .get(organizationId, contactId) as { created_at: string } | undefined;

  if (!firstRow) return null;

  // First outbound contact
  const outboundTypes = Array.from(OUTBOUND_TYPES);
  const placeholders = outboundTypes.map(() => '?').join(', ');

  const outboundRow = db
    .prepare(
      `SELECT created_at FROM timeline_events
       WHERE organization_id = ? AND contact_id = ? AND type IN (${placeholders})
       ORDER BY created_at ASC LIMIT 1`
    )
    .get(organizationId, contactId, ...outboundTypes) as { created_at: string } | undefined;

  if (!outboundRow) return null;

  const createdMs = new Date(firstRow.created_at).getTime();
  const outboundMs = new Date(outboundRow.created_at).getTime();
  const diffMinutes = Math.max(0, Math.round((outboundMs - createdMs) / 60_000));

  return diffMinutes;
}

/**
 * Average speed-to-lead across all contacts in the organization
 * within the given number of days (default 30).
 * Returns 0 if no data is available.
 */
export function getAverageSpeedToLead(
  organizationId: string,
  days: number = 30
): number {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get all unique contact IDs with events in the window
  const contactRows = db
    .prepare(
      `SELECT DISTINCT contact_id FROM timeline_events
       WHERE organization_id = ? AND created_at >= ?`
    )
    .all(organizationId, cutoff) as { contact_id: string }[];

  if (contactRows.length === 0) return 0;

  let totalMinutes = 0;
  let count = 0;

  for (const row of contactRows) {
    const stl = getSpeedToLead(organizationId, row.contact_id);
    if (stl !== null) {
      totalMinutes += stl;
      count++;
    }
  }

  return count > 0 ? Math.round(totalMinutes / count) : 0;
}

// ============================================================================
// Helpers
// ============================================================================

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.max(0, Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay));
}

function rowToEvent(row: TimelineRow): TimelineEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    type: row.type as TimelineEventType,
    title: row.title,
    description: row.description ?? undefined,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, string>) : undefined,
    source: row.source as TimelineEvent['source'],
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
  };
}

async function generateAiSummary(
  events: TimelineEvent[],
  totalInteractions: number,
  daysSinceLastContact: number
): Promise<string> {
  if (events.length === 0) {
    return 'No activity recorded for this contact yet.';
  }

  const eventDescriptions = events
    .slice(0, 20)
    .map((e) => `- [${e.type}] ${e.title}${e.description ? ': ' + e.description : ''}`)
    .join('\n');

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:
        'You are a CRM assistant for real estate agents. Given a list of recent timeline events for a contact, write a concise 2-3 sentence summary that highlights the relationship status, key interactions, and next steps. Be direct and actionable.',
      messages: [
        {
          role: 'user',
          content: `Contact has ${totalInteractions} total interactions. Last contact was ${daysSinceLastContact} days ago.\n\nRecent events:\n${eventDescriptions}\n\nWrite a 2-3 sentence summary.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return 'Unable to generate summary.';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Timeline] AI summary error:', message);
    return `${totalInteractions} interactions recorded. Last contact ${daysSinceLastContact} day(s) ago.`;
  }
}
