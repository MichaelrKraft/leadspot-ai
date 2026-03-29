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
// Parsing Prompt
// ============================================================================

const VOICE_PARSE_SYSTEM_PROMPT = `You are a voice command parser for a real estate CRM. You receive transcribed voice input from real estate agents and extract structured commands.

Return a JSON object with these fields:
- type: one of "update_stage", "add_tag", "remove_tag", "add_note", "schedule_followup", "log_activity", "create_contact", "get_summary", "unknown"
- confidence: number 0-1 indicating how confident you are in the classification
- contactName: the contact name mentioned (null if none)
- parameters: object with relevant extracted parameters
- suggestedConfirmation: a short human-readable confirmation question

Parameter keys by type:
- update_stage: { stage: "new-lead" | "contacted" | "qualified" | "showing" | "offer" | "under-contract" | "closed" | "lost" }
- add_tag / remove_tag: { tag: "slug-form-tag" }
- add_note: { note: "the note content" }
- schedule_followup: { date: "YYYY-MM-DD or relative", time: "HH:MM or empty" }
- log_activity: { activity: "showing" | "call" | "meeting" | "open-house", location?: "address" }
- create_contact: { firstName, lastName, phone?, email?, source? }
- get_summary: {} (no extra params needed)

Real estate terminology to recognize:
- "hot lead", "warm lead", "cold lead" -> tags
- "under contract", "pending", "closing" -> stages
- "showing", "open house", "walkthrough" -> activities
- "buyer", "seller", "investor", "renter" -> tags
- "pre-approved", "pre-qual" -> tags
- "listing appointment", "CMA" -> activities

IMPORTANT: Always return valid JSON only, no markdown fencing, no extra text.`;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Parse natural language voice input into a structured CRM command.
 * Uses Claude Haiku for fast, cheap intent classification.
 */
export async function parseVoiceCommand(
  text: string,
  organizationId: string
): Promise<ParsedVoiceCommand> {
  ensureTables(organizationId);

  const trimmed = text.trim();
  if (!trimmed) {
    return buildUnknownCommand(trimmed, 'Could not understand the command. Please try again.');
  }

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: VOICE_PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Parse this voice command from a real estate agent:\n\n"${trimmed}"`,
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
 * Each command type has its own handler; actual API calls are stubbed.
 */
export async function executeVoiceCommand(
  command: ParsedVoiceCommand,
  organizationId: string
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

  return handler(command, organizationId);
}

/**
 * Get recent voice commands for the organization.
 */
export function getCommandHistory(
  organizationId: string,
  limit: number = 20
): ParsedVoiceCommand[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const rows = db
    .prepare(
      `SELECT * FROM voice_commands
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(organizationId, limit) as VoiceCommandRow[];

  return rows.map(rowToCommand);
}

// ============================================================================
// Command Handlers
// ============================================================================

type CommandHandler = (
  command: ParsedVoiceCommand,
  organizationId: string
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
  _organizationId: string
): Promise<VoiceCommandResult> {
  const tag = command.parameters.tag;
  if (!tag || !command.contactName) {
    return confirm(command, 'Missing tag or contact name. Please try again.');
  }
  // TODO: Call FUB/CRM API to add tag to contact
  return success(command, `Tagged ${command.contactName} as "${tag}".`);
}

async function handleRemoveTag(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  const tag = command.parameters.tag;
  if (!tag || !command.contactName) {
    return confirm(command, 'Missing tag or contact name. Please try again.');
  }
  // TODO: Call FUB/CRM API to remove tag from contact
  return success(command, `Removed tag "${tag}" from ${command.contactName}.`);
}

async function handleAddNote(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  const note = command.parameters.note;
  if (!note || !command.contactName) {
    return confirm(command, 'Missing note content or contact name.');
  }
  // TODO: Call FUB/CRM API to add note to contact
  return success(command, `Note added to ${command.contactName}.`);
}

async function handleUpdateStage(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  const stage = command.parameters.stage;
  if (!stage || !command.contactName) {
    return confirm(command, 'Missing stage or contact name.');
  }
  // TODO: Call FUB/CRM API to update deal stage
  return success(command, `Moved ${command.contactName} to "${stage}".`);
}

async function handleScheduleFollowup(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  const date = command.parameters.date;
  if (!date || !command.contactName) {
    return confirm(command, 'Missing date or contact name for follow-up.');
  }
  const time = command.parameters.time ? ` at ${command.parameters.time}` : '';
  // TODO: Call FUB/CRM API to create follow-up task
  return success(command, `Follow-up with ${command.contactName} scheduled for ${date}${time}.`);
}

async function handleLogActivity(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  const activity = command.parameters.activity;
  if (!activity) {
    return confirm(command, 'Missing activity type. Please try again.');
  }
  const location = command.parameters.location ? ` at ${command.parameters.location}` : '';
  const contact = command.contactName ? ` with ${command.contactName}` : '';
  // TODO: Call FUB/CRM API to log activity
  return success(command, `Logged ${activity}${contact}${location}.`);
}

async function handleCreateContact(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  const firstName = command.parameters.firstName;
  const lastName = command.parameters.lastName;
  if (!firstName || !lastName) {
    return confirm(command, 'Need at least a first and last name to create a contact.');
  }
  // TODO: Call FUB/CRM API to create new contact
  return success(command, `Created new contact: ${firstName} ${lastName}.`);
}

async function handleGetSummary(
  command: ParsedVoiceCommand,
  _organizationId: string
): Promise<VoiceCommandResult> {
  if (!command.contactName) {
    return confirm(command, 'Which contact do you want a summary for?');
  }
  // TODO: Fetch contact data from CRM and generate AI summary
  return {
    success: true,
    command,
    message: `Summary for ${command.contactName}: No data loaded yet (CRM integration pending).`,
    requiresConfirmation: false,
  };
}

async function handleUnknown(
  command: ParsedVoiceCommand,
  _organizationId: string
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

function confirm(command: ParsedVoiceCommand, message: string): VoiceCommandResult {
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    organizationId,
    command.rawText,
    command.type,
    command.contactName ?? null,
    JSON.stringify(command.parameters),
    command.confidence,
    command.suggestedConfirmation
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
