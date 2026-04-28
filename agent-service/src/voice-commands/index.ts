/**
 * LeadSpot Agent Service - Voice Command Processing
 *
 * Parses natural language voice input (already transcribed on the mobile client)
 * into structured CRM actions. Uses Claude Haiku for intent classification and
 * entity extraction so agents can update their CRM hands-free while driving.
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { getDb } from '../db';

// ============================================================================
// Types
// ============================================================================

export type VoiceCommandType =
  | 'update_stage'
  | 'add_tag'
  | 'remove_tag'
  | 'add_note'
  | 'schedule_followup'
  | 'log_activity'
  | 'create_contact'
  | 'get_summary'
  | 'unknown';

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  confidence: number;
  contactName?: string;
  parameters: Record<string, string>;
  rawText: string;
  suggestedConfirmation: string;
}

export interface VoiceCommandResult {
  success: boolean;
  command: ParsedVoiceCommand;
  message: string;
  requiresConfirmation: boolean;
}

// ============================================================================
// DB Row Types
// ============================================================================

interface VoiceCommandRow {
  id: string;
  organization_id: string;
  raw_text: string;
  parsed_type: string;
  contact_name: string | null;
  parameters: string;
  confidence: number;
  suggested_confirmation: string;
  created_at: string;
}

// ============================================================================
// Schema
// ============================================================================

const TABLES_INITIALIZED = new Set<string>();

function ensureTables(organizationId: string): void {
  if (TABLES_INITIALIZED.has(organizationId)) return;
  const db = getDb(organizationId);

  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_commands (
      id                      TEXT PRIMARY KEY,
      organization_id         TEXT NOT NULL,
      raw_text                TEXT NOT NULL,
      parsed_type             TEXT NOT NULL,
      contact_name            TEXT,
      parameters              TEXT NOT NULL DEFAULT '{}',
      confidence              REAL NOT NULL DEFAULT 0,
      suggested_confirmation  TEXT NOT NULL DEFAULT '',
      created_at              TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_voice_commands_org
      ON voice_commands(organization_id, created_at DESC);
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
// Backend Request Helper
// ============================================================================

async function backendRequest(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<unknown> {
  const url = `${process.env.LEADSPOT_API_URL ?? 'http://localhost:8000'}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend ${method} ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

// ============================================================================
// Phone Normalization Helper
// ============================================================================

function tryNormalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return null;
}

// ============================================================================
// Contact Resolution
// ============================================================================

type ContactResolution =
  | { found: true; contactId: string; contactName: string }
  | { ambiguous: true; matches: { id: string; name: string }[]; confirmationMessage: string }
  | { notFound: true };

async function resolveContact(
  nameOrPhone: string,
  token?: string,
): Promise<ContactResolution> {
  if (!nameOrPhone.trim()) return { notFound: true };

  // Phone-first lookup
  const normalized = tryNormalizePhone(nameOrPhone);
  if (normalized) {
    const data = await backendRequest(
      'GET',
      `/api/contacts?phone=${encodeURIComponent(normalized)}&limit=1`,
      undefined,
      token,
    ) as { contacts?: { id: string; name: string }[] };
    if (data.contacts?.length === 1) {
      return {
        found: true,
        contactId: data.contacts[0].id,
        contactName: data.contacts[0].name,
      };
    }
  }

  // Name search fallback
  const data = await backendRequest(
    'GET',
    `/api/contacts?q=${encodeURIComponent(nameOrPhone)}&limit=3`,
    undefined,
    token,
  ) as { contacts?: { id: string; name: string }[] };
  const contacts = data.contacts ?? [];

  if (contacts.length === 0) return { notFound: true };
  if (contacts.length === 1) {
    return { found: true, contactId: contacts[0].id, contactName: contacts[0].name };
  }

  const names = contacts.map((c) => c.name).join(', ');
  return {
    ambiguous: true,
    matches: contacts,
    confirmationMessage: `I found ${contacts.length} contacts matching "${nameOrPhone}": ${names}. Which one did you mean?`,
  };
}

// ============================================================================
// Pipeline Stages Helper
// ============================================================================

const DEFAULT_PIPELINE_STAGES = [
  'new-lead', 'contacted', 'qualified', 'estimate-sent',
  'job-scheduled', 'in-progress', 'completed',
  'showing-scheduled', 'offer-submitted', 'under-contract',
  'closed', 'lost', 'not-interested',
];

async function getOrgPipelineStages(organizationId: string): Promise<string[]> {
  try {
    const db = getDb(organizationId);
    const rows = db
      .prepare('SELECT stage_name FROM pipeline_stages ORDER BY sort_order')
      .all() as { stage_name: string }[];
    if (rows.length > 0) return rows.map((r) => r.stage_name);
  } catch {
    // Table may not exist yet — fall through to defaults
  }
  return DEFAULT_PIPELINE_STAGES;
}

// ============================================================================
// Relative Date Parser
// ============================================================================

function parseRelativeDate(text: string): Date {
  const lower = text.toLowerCase().trim();
  const now = new Date();

  // "tomorrow"
  if (lower === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // "next week"
  if (lower === 'next week') {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // "in N days"
  const inDaysMatch = lower.match(/^in (\d+) days?$/);
  if (inDaysMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10));
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // Day of week: "monday", "tuesday", etc. with optional "at HH:MM" or "at Npm"
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = lower.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at\s+(.+))?$/);
  if (dayMatch) {
    const targetDay = days.indexOf(dayMatch[1]);
    const d = new Date(now);
    const currentDay = d.getDay();
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntil);

    if (dayMatch[2]) {
      const timeStr = dayMatch[2].trim();
      const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const meridiem = timeMatch[3]?.toLowerCase();
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
        d.setHours(hours, minutes, 0, 0);
      } else {
        d.setHours(9, 0, 0, 0);
      }
    } else {
      d.setHours(9, 0, 0, 0);
    }
    return d;
  }

  // Try native Date parsing as a last resort
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return parsed;

  // Default: tomorrow at 9am
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}

// ============================================================================
// Parsing Prompt
// ============================================================================

function buildSystemPrompt(stages: string[]): string {
  return `You are a voice command parser for a sales CRM used by service companies and real estate agents.

Pipeline stages for this organization: ${stages.join(', ')}.

Parse the following voice input into a structured command. Return JSON only.

Command types:
- update_stage: move a contact/deal to a pipeline stage
- add_tag: tag a contact (e.g., "hot lead", "qualified", "interested")
- remove_tag: remove a tag from a contact
- add_note: add a call note to a contact record
- schedule_followup: schedule a follow-up task
- log_activity: log an activity (call, meeting, showing, estimate)
- create_contact: create a new contact
- get_summary: get a summary of contact history
- unknown: cannot parse

For each command, extract:
- contactName or contactPhone (who the command is about)
- relevant parameters (tag name, stage name, note content, date/time, activity type, etc.)
- confidence: 0.0-1.0

Parameter keys by type:
- update_stage: { stage: "stage-name-from-list-above" }
- add_tag / remove_tag: { tag: "slug-form-tag" }
- add_note: { note: "the note content" }
- schedule_followup: { date: "YYYY-MM-DD or relative text", time: "HH:MM or empty", notes: "optional context" }
- log_activity: { activityType: "call" | "meeting" | "showing" | "estimate" | "open-house", notes?: "optional" }
- create_contact: { name: "full name", firstName: "first", lastName: "last", phone?: "raw phone", email?: "email", source?: "source" }
- get_summary: {}
- suggestedConfirmation: a short human-readable confirmation question

Service company vocabulary: estimate, job, appointment, quote, follow-up
Real estate vocabulary: showing, open house, buyer, seller, investor, under contract, closing, listing

IMPORTANT: Always return valid JSON only, no markdown fencing, no extra text.`;
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Parse natural language voice input into a structured CRM command.
 * Uses Claude Haiku for fast, cheap intent classification.
 */
export async function parseVoiceCommand(
  text: string,
  organizationId: string,
): Promise<ParsedVoiceCommand> {
  ensureTables(organizationId);

  const trimmed = text.trim();
  if (!trimmed) {
    return buildUnknownCommand(trimmed, 'Could not understand the command. Please try again.');
  }

  try {
    const [client, stages] = await Promise.all([
      Promise.resolve(getAnthropicClient()),
      getOrgPipelineStages(organizationId),
    ]);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildSystemPrompt(stages),
      messages: [
        {
          role: 'user',
          content: `Parse this voice command:\n\n"${trimmed}"`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return buildUnknownCommand(trimmed, 'Could not parse the command. Please try again.');
    }

    const parsed: ParsedVoiceCommand = parseClaudeResponse(content.text, trimmed);

    // Persist to DB
    saveCommand(organizationId, parsed);

    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] Parse error:', message);
    return buildUnknownCommand(trimmed, 'Failed to process voice command. Please try again.');
  }
}

/**
 * Execute a parsed voice command against the CRM.
 * Token is the caller's bearer token forwarded to the backend API.
 */
export async function executeVoiceCommand(
  command: ParsedVoiceCommand,
  organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  ensureTables(organizationId);

  // Low-confidence commands always require confirmation
  if (command.confidence < 0.6) {
    return {
      success: false,
      command,
      message: 'Low confidence — please confirm or rephrase.',
      requiresConfirmation: true,
    };
  }

  const handler = COMMAND_HANDLERS[command.type];
  if (!handler) {
    return {
      success: false,
      command,
      message: `Unrecognized command type: ${command.type}`,
      requiresConfirmation: false,
    };
  }

  return handler(command, organizationId, token);
}

/**
 * Get recent voice commands for the organization.
 */
export function getCommandHistory(
  organizationId: string,
  limit: number = 20,
): ParsedVoiceCommand[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const rows = db
    .prepare(
      `SELECT * FROM voice_commands
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(organizationId, limit) as VoiceCommandRow[];

  return rows.map(rowToCommand);
}

// ============================================================================
// Command Handlers
// ============================================================================

type CommandHandler = (
  command: ParsedVoiceCommand,
  organizationId: string,
  token?: string,
) => Promise<VoiceCommandResult>;

const COMMAND_HANDLERS: Record<VoiceCommandType, CommandHandler> = {
  add_tag: handleAddTag,
  remove_tag: handleRemoveTag,
  add_note: handleAddNote,
  update_stage: handleUpdateStage,
  schedule_followup: handleScheduleFollowup,
  log_activity: handleLogActivity,
  create_contact: handleCreateContact,
  get_summary: handleGetSummary,
  unknown: handleUnknown,
};

async function handleAddTag(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';
  if (!nameOrPhone) {
    return confirm(command, 'Missing contact name. Please try again.');
  }
  const tagToAdd = command.parameters.tag ?? command.parameters.tagName ?? '';
  if (!tagToAdd) {
    return confirm(command, 'Missing tag name. Please try again.');
  }

  try {
    const resolution = await resolveContact(nameOrPhone, token);
    if ('notFound' in resolution) {
      return fail(command, `Contact "${nameOrPhone}" not found.`);
    }
    if ('ambiguous' in resolution) {
      return confirmMsg(command, resolution.confirmationMessage);
    }

    const contact = await backendRequest(
      'GET',
      `/api/contacts/${resolution.contactId}`,
      undefined,
      token,
    ) as { tags?: string[] };

    const currentTags = contact.tags ?? [];
    if (currentTags.includes(tagToAdd)) {
      return success(command, `${resolution.contactName} already has the tag "${tagToAdd}".`);
    }

    await backendRequest(
      'PATCH',
      `/api/contacts/${resolution.contactId}`,
      { tags: [...currentTags, tagToAdd] },
      token,
    );

    return success(command, `Tagged ${resolution.contactName} as "${tagToAdd}".`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleAddTag error:', message);
    return fail(command, `Error adding tag: ${message}`);
  }
}

async function handleRemoveTag(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';
  if (!nameOrPhone) {
    return confirm(command, 'Missing contact name. Please try again.');
  }
  const tagToRemove = command.parameters.tag ?? command.parameters.tagName ?? '';
  if (!tagToRemove) {
    return confirm(command, 'Missing tag name. Please try again.');
  }

  try {
    const resolution = await resolveContact(nameOrPhone, token);
    if ('notFound' in resolution) {
      return fail(command, `Contact "${nameOrPhone}" not found.`);
    }
    if ('ambiguous' in resolution) {
      return confirmMsg(command, resolution.confirmationMessage);
    }

    const contact = await backendRequest(
      'GET',
      `/api/contacts/${resolution.contactId}`,
      undefined,
      token,
    ) as { tags?: string[] };

    const currentTags = contact.tags ?? [];
    if (!currentTags.includes(tagToRemove)) {
      return success(command, `${resolution.contactName} does not have the tag "${tagToRemove}".`);
    }

    const updatedTags = currentTags.filter((t) => t !== tagToRemove);
    await backendRequest(
      'PATCH',
      `/api/contacts/${resolution.contactId}`,
      { tags: updatedTags },
      token,
    );

    return success(command, `Removed tag "${tagToRemove}" from ${resolution.contactName}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleRemoveTag error:', message);
    return fail(command, `Error removing tag: ${message}`);
  }
}

async function handleAddNote(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';
  if (!nameOrPhone) {
    return confirm(command, 'Missing contact name. Please try again.');
  }
  const noteContent = command.parameters.note ?? command.parameters.content ?? '';
  if (!noteContent) {
    return confirm(command, 'Missing note content. Please try again.');
  }

  try {
    const resolution = await resolveContact(nameOrPhone, token);
    if ('notFound' in resolution) {
      return fail(command, `Contact "${nameOrPhone}" not found.`);
    }
    if ('ambiguous' in resolution) {
      return confirmMsg(command, resolution.confirmationMessage);
    }

    await backendRequest(
      'POST',
      '/api/conversations',
      {
        type: 'call',
        contact_id: resolution.contactId,
        content: noteContent,
        occurred_at: new Date().toISOString(),
      },
      token,
    );

    return success(command, `Note added to ${resolution.contactName}'s record.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleAddNote error:', message);
    return fail(command, `Error adding note: ${message}`);
  }
}

async function handleUpdateStage(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';
  if (!nameOrPhone) {
    return confirm(command, 'Missing contact name. Please try again.');
  }
  const stage = command.parameters.stage ?? '';
  if (!stage) {
    return confirm(command, 'Missing stage name. Please try again.');
  }

  try {
    const resolution = await resolveContact(nameOrPhone, token);
    if ('notFound' in resolution) {
      return fail(command, `Contact "${nameOrPhone}" not found.`);
    }
    if ('ambiguous' in resolution) {
      return confirmMsg(command, resolution.confirmationMessage);
    }

    const deals = await backendRequest(
      'GET',
      `/api/contacts/${resolution.contactId}/deals`,
      undefined,
      token,
    ) as { deals?: { id: string; stage: string }[] };

    const deal = deals.deals?.[0];
    if (!deal) {
      return fail(command, `No deal found for ${resolution.contactName}.`);
    }

    await backendRequest(
      'PATCH',
      `/api/deals/${deal.id}`,
      { stage },
      token,
    );

    return success(command, `Moved ${resolution.contactName} to "${stage}" stage.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleUpdateStage error:', message);
    return fail(command, `Error updating stage: ${message}`);
  }
}

async function handleScheduleFollowup(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';
  if (!nameOrPhone) {
    return confirm(command, 'Missing contact name. Please try again.');
  }

  try {
    const resolution = await resolveContact(nameOrPhone, token);
    if ('notFound' in resolution) {
      return fail(command, `Contact "${nameOrPhone}" not found.`);
    }
    if ('ambiguous' in resolution) {
      return confirmMsg(command, resolution.confirmationMessage);
    }

    const dateText = command.parameters.date ?? command.parameters.time ?? 'tomorrow';
    const dueAt = parseRelativeDate(dateText);

    await backendRequest(
      'POST',
      '/api/tasks',
      {
        contact_id: resolution.contactId,
        type: 'followup',
        notes: command.parameters.notes ?? `Follow up with ${resolution.contactName}`,
        due_at: dueAt.toISOString(),
      },
      token,
    );

    return success(command, `Follow-up scheduled for ${dueAt.toLocaleDateString()}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleScheduleFollowup error:', message);
    return fail(command, `Error scheduling follow-up: ${message}`);
  }
}

async function handleLogActivity(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const activityType = command.parameters.activityType ?? command.parameters.activity ?? 'call';
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';

  try {
    let contactId: string | undefined;
    let contactLabel = '';

    if (nameOrPhone) {
      const resolution = await resolveContact(nameOrPhone, token);
      if ('found' in resolution) {
        contactId = resolution.contactId;
        contactLabel = ` with ${resolution.contactName}`;
      } else if ('ambiguous' in resolution) {
        return confirmMsg(command, resolution.confirmationMessage);
      }
    }

    await backendRequest(
      'POST',
      '/api/activities',
      {
        contact_id: contactId ?? null,
        type: activityType,
        notes: command.parameters.notes ?? '',
        occurred_at: new Date().toISOString(),
      },
      token,
    );

    return success(command, `Logged ${activityType}${contactLabel}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleLogActivity error:', message);
    return fail(command, `Error logging activity: ${message}`);
  }
}

async function handleCreateContact(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const rawName =
    command.parameters.name ??
    (command.parameters.firstName && command.parameters.lastName
      ? `${command.parameters.firstName} ${command.parameters.lastName}`
      : null) ??
    command.contactName ??
    '';

  if (!rawName.trim()) {
    return confirm(command, 'Need at least a first and last name to create a contact.');
  }

  try {
    // Check for duplicate by phone first
    const rawPhone = command.parameters.phone ?? '';
    const phone = rawPhone ? tryNormalizePhone(rawPhone) : null;

    if (phone) {
      const existing = await resolveContact(phone, token);
      if ('found' in existing) {
        return success(command, `Contact already exists: ${existing.contactName}.`);
      }
    }

    const newContact = await backendRequest(
      'POST',
      '/api/contacts',
      {
        name: rawName.trim(),
        phone: phone ?? rawPhone,
        email: command.parameters.email ?? '',
        source: command.parameters.source ?? 'voice',
      },
      token,
    ) as { id: string; name: string };

    return success(command, `Created contact ${newContact.name}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleCreateContact error:', message);
    return fail(command, `Error creating contact: ${message}`);
  }
}

async function handleGetSummary(
  command: ParsedVoiceCommand,
  _organizationId: string,
  token?: string,
): Promise<VoiceCommandResult> {
  const nameOrPhone = command.contactName ?? command.parameters.contactPhone ?? '';
  if (!nameOrPhone) {
    return confirm(command, 'Which contact do you want a summary for?');
  }

  try {
    const resolution = await resolveContact(nameOrPhone, token);
    if ('notFound' in resolution) {
      return fail(command, `Contact "${nameOrPhone}" not found.`);
    }
    if ('ambiguous' in resolution) {
      return confirmMsg(command, resolution.confirmationMessage);
    }

    const [contact, conversations] = await Promise.all([
      backendRequest('GET', `/api/contacts/${resolution.contactId}`, undefined, token),
      backendRequest(
        'GET',
        `/api/conversations?contact_id=${resolution.contactId}&limit=5`,
        undefined,
        token,
      ),
    ]);

    const client = getAnthropicClient();
    const summaryResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Summarize this contact's history in 2-3 sentences for a sales rep on a call:\nContact: ${JSON.stringify(contact)}\nRecent conversations: ${JSON.stringify(conversations)}`,
        },
      ],
    });

    const firstBlock = summaryResponse.content[0];
    const summaryText =
      firstBlock.type === 'text' ? firstBlock.text : 'No summary available.';

    return success(command, summaryText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceCommands] handleGetSummary error:', message);
    return fail(command, `Error generating summary: ${message}`);
  }
}

async function handleUnknown(
  command: ParsedVoiceCommand,
  _organizationId: string,
  _token?: string,
): Promise<VoiceCommandResult> {
  return {
    success: false,
    command,
    message: "Sorry, I didn't understand that command. Try something like \"tag John as hot lead\" or \"add a note to Sarah's file\".",
    requiresConfirmation: false,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function success(command: ParsedVoiceCommand, message: string): VoiceCommandResult {
  return { success: true, command, message, requiresConfirmation: false };
}

function fail(command: ParsedVoiceCommand, message: string): VoiceCommandResult {
  return { success: false, command, message, requiresConfirmation: false };
}

function confirm(command: ParsedVoiceCommand, message: string): VoiceCommandResult {
  return { success: false, command, message, requiresConfirmation: true };
}

function confirmMsg(command: ParsedVoiceCommand, message: string): VoiceCommandResult {
  return { success: false, command, message, requiresConfirmation: true };
}

function buildUnknownCommand(rawText: string, confirmation: string): ParsedVoiceCommand {
  return {
    type: 'unknown',
    confidence: 0,
    parameters: {},
    rawText,
    suggestedConfirmation: confirmation,
  };
}

function parseClaudeResponse(responseText: string, rawText: string): ParsedVoiceCommand {
  try {
    const data = JSON.parse(responseText) as Record<string, unknown>;

    const type = (typeof data.type === 'string' ? data.type : 'unknown') as VoiceCommandType;
    const confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;
    const contactName = typeof data.contactName === 'string' ? data.contactName : undefined;
    const parameters =
      typeof data.parameters === 'object' && data.parameters !== null
        ? toStringRecord(data.parameters as Record<string, unknown>)
        : {};
    const suggestedConfirmation =
      typeof data.suggestedConfirmation === 'string'
        ? data.suggestedConfirmation
        : `Execute ${type} command?`;

    return {
      type,
      confidence,
      contactName: contactName || undefined,
      parameters,
      rawText,
      suggestedConfirmation,
    };
  } catch {
    return buildUnknownCommand(rawText, 'Could not parse the command. Please try again.');
  }
}

function toStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = String(value);
    }
  }
  return result;
}

function saveCommand(organizationId: string, command: ParsedVoiceCommand): void {
  const db = getDb(organizationId);
  db.prepare(
    `INSERT INTO voice_commands (id, organization_id, raw_text, parsed_type, contact_name, parameters, confidence, suggested_confirmation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    organizationId,
    command.rawText,
    command.type,
    command.contactName ?? null,
    JSON.stringify(command.parameters),
    command.confidence,
    command.suggestedConfirmation,
  );
}

function rowToCommand(row: VoiceCommandRow): ParsedVoiceCommand {
  return {
    type: row.parsed_type as VoiceCommandType,
    confidence: row.confidence,
    contactName: row.contact_name ?? undefined,
    parameters: JSON.parse(row.parameters) as Record<string, string>,
    rawText: row.raw_text,
    suggestedConfirmation: row.suggested_confirmation,
  };
}
