/**
 * LeadSpot Agent Service - SQLite Database Layer
 *
 * Per-organization SQLite database manager. Each organization gets its own
 * database file stored at {dataDir}/orgs/{organizationId}/agent.db.
 *
 * Connections are cached in memory and reused across calls.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentSuggestion, PipelineBrief } from '../types';

// ============================================================================
// Configuration
// ============================================================================

let dataDir = process.env.AGENT_DATA_DIR || path.join(process.cwd(), 'data');

/** Override the base data directory (useful for tests or custom deployments) */
export function setDataDir(dir: string): void {
  dataDir = dir;
}

/** Get the current data directory */
export function getDataDir(): string {
  return dataDir;
}

// ============================================================================
// Connection Cache
// ============================================================================

const connections: Map<string, Database.Database> = new Map();

/**
 * Get the file path for an organization's database.
 */
function getDbPath(organizationId: string): string {
  return path.join(dataDir, 'orgs', organizationId, 'agent.db');
}

/**
 * Get (or create) a SQLite database connection for the given organization.
 * Connections are cached so subsequent calls return the same instance.
 */
export function getDb(organizationId: string): Database.Database {
  const existing = connections.get(organizationId);
  if (existing) {
    return existing;
  }

  const dbPath = getDbPath(organizationId);
  const dir = path.dirname(dbPath);

  // Ensure the directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables on first open
  createTables(db);

  connections.set(organizationId, db);
  return db;
}

// ============================================================================
// Schema
// ============================================================================

/**
 * Create all required tables if they don't already exist.
 */
function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS extracted_facts (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      contact_id        TEXT NOT NULL,
      fact_type         TEXT NOT NULL,
      fact_key          TEXT NOT NULL,
      fact_value        TEXT NOT NULL,
      confidence        REAL NOT NULL DEFAULT 0.5,
      source            TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      last_referenced   TEXT,
      reference_count   INTEGER NOT NULL DEFAULT 0,
      UNIQUE(organization_id, contact_id, fact_key)
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      type              TEXT NOT NULL,
      contact_id        TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      draft             TEXT,
      priority          TEXT NOT NULL DEFAULT 'medium',
      status            TEXT NOT NULL DEFAULT 'pending',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      executed_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS briefs (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      generated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      summary           TEXT NOT NULL,
      data              JSON
    );

    CREATE TABLE IF NOT EXISTS cron_jobs (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      name              TEXT NOT NULL,
      schedule          JSON NOT NULL,
      payload           JSON NOT NULL,
      enabled           INTEGER NOT NULL DEFAULT 1,
      created_at        INTEGER NOT NULL,
      last_run          INTEGER,
      next_run          INTEGER,
      delete_after_run  INTEGER NOT NULL DEFAULT 0,
      UNIQUE(organization_id, name)
    );

    CREATE TABLE IF NOT EXISTS cron_runs (
      job_id            TEXT NOT NULL,
      timestamp         INTEGER NOT NULL,
      status            TEXT NOT NULL,
      duration_ms       INTEGER NOT NULL,
      error             TEXT
    );
  `);

  // Indexes for common query patterns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_facts_org_contact
      ON extracted_facts(organization_id, contact_id);

    CREATE INDEX IF NOT EXISTS idx_suggestions_org_status
      ON suggestions(organization_id, status);

    CREATE INDEX IF NOT EXISTS idx_briefs_org
      ON briefs(organization_id);

    CREATE INDEX IF NOT EXISTS idx_cron_jobs_org
      ON cron_jobs(organization_id);

    CREATE INDEX IF NOT EXISTS idx_cron_runs_job
      ON cron_runs(job_id);
  `);
}

// ============================================================================
// Public Helpers
// ============================================================================

/**
 * Ensure the database for a given organization is initialized.
 * Safe to call multiple times; tables are created with IF NOT EXISTS.
 */
export function initializeDb(organizationId: string): void {
  getDb(organizationId);
}

/**
 * Close all open database connections. Call this on process shutdown.
 */
export function closeAll(): void {
  for (const [orgId, db] of connections) {
    try {
      db.close();
    } catch (err) {
      console.error(`[DB] Failed to close database for org ${orgId}:`, err);
    }
  }
  connections.clear();
  console.log('[DB] All database connections closed');
}

/**
 * Close a single organization's database connection.
 */
export function closeDb(organizationId: string): void {
  const db = connections.get(organizationId);
  if (db) {
    try {
      db.close();
    } catch (err) {
      console.error(`[DB] Failed to close database for org ${organizationId}:`, err);
    }
    connections.delete(organizationId);
  }
}

/**
 * Get the number of currently open database connections.
 */
export function connectionCount(): number {
  return connections.size;
}

// ============================================================================
// Row Types
// ============================================================================

interface SuggestionRow {
  id: string;
  organization_id: string;
  type: string;
  contact_id: string;
  title: string;
  description: string;
  draft: string | null;
  priority: string;
  status: string;
  created_at: string;
  executed_at: string | null;
}

// ============================================================================
// Row Mappers
// ============================================================================

function rowToSuggestion(r: SuggestionRow): AgentSuggestion {
  return {
    id: r.id,
    organizationId: r.organization_id,
    type: r.type as AgentSuggestion['type'],
    contactId: r.contact_id,
    title: r.title,
    description: r.description,
    draft: r.draft ?? undefined,
    priority: r.priority as AgentSuggestion['priority'],
    status: r.status as AgentSuggestion['status'],
    createdAt: r.created_at,
    executedAt: r.executed_at ?? undefined,
  };
}

// ============================================================================
// CRUD - Suggestions
// ============================================================================

/**
 * Insert or replace a suggestion for the given organization.
 */
export function insertSuggestion(organizationId: string, suggestion: AgentSuggestion): void {
  const db = getDb(organizationId);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO suggestions
      (id, organization_id, type, contact_id, title, description, draft, priority, status, created_at, executed_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    suggestion.id,
    organizationId,
    suggestion.type,
    suggestion.contactId,
    suggestion.title,
    suggestion.description,
    suggestion.draft ?? null,
    suggestion.priority,
    suggestion.status,
    suggestion.createdAt,
    suggestion.executedAt ?? null,
  );
}

/**
 * Query suggestions for an organization with optional filters.
 */
export function getSuggestions(
  organizationId: string,
  options?: { status?: string; contactId?: string; limit?: number },
): AgentSuggestion[] {
  const db = getDb(organizationId);

  let sql = 'SELECT * FROM suggestions WHERE organization_id = ?';
  const params: (string | number)[] = [organizationId];

  if (options?.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }
  if (options?.contactId) {
    sql += ' AND contact_id = ?';
    params.push(options.contactId);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(sql).all(...params) as SuggestionRow[];
  return rows.map(rowToSuggestion);
}

/**
 * Update the status (and optionally executed_at) of a suggestion.
 * Returns the number of rows changed (0 if not found, 1 if updated).
 */
export function updateSuggestionStatus(
  organizationId: string,
  suggestionId: string,
  status: AgentSuggestion['status'],
  executedAt?: string,
): number {
  const db = getDb(organizationId);
  const result = db.prepare(`
    UPDATE suggestions
    SET status = ?, executed_at = ?
    WHERE id = ? AND organization_id = ?
  `).run(status, executedAt ?? null, suggestionId, organizationId);
  return result.changes;
}

// ============================================================================
// CRUD - Briefs
// ============================================================================

/**
 * Insert a pipeline brief for the given organization.
 * Extra fields (newLeads, followUpsNeeded, etc.) are serialized into the data column.
 */
export function insertBrief(organizationId: string, brief: PipelineBrief): void {
  const db = getDb(organizationId);
  const data = JSON.stringify({
    newLeads: brief.newLeads,
    followUpsNeeded: brief.followUpsNeeded,
    dealsAtRisk: brief.dealsAtRisk,
    campaignHighlights: brief.campaignHighlights,
    suggestedActions: brief.suggestedActions,
  });
  db.prepare(`
    INSERT INTO briefs (id, organization_id, generated_at, summary, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(brief.id, organizationId, brief.generatedAt, brief.summary, data);
}

/**
 * Get the most recent pipeline brief for an organization.
 * Returns null if no briefs exist.
 */
export function getLatestBrief(organizationId: string): PipelineBrief | null {
  const db = getDb(organizationId);
  const row = db.prepare(`
    SELECT * FROM briefs
    WHERE organization_id = ?
    ORDER BY generated_at DESC
    LIMIT 1
  `).get(organizationId) as { id: string; organization_id: string; generated_at: string; summary: string; data: string } | undefined;

  if (!row) return null;

  const data = JSON.parse(row.data) as {
    newLeads: number;
    followUpsNeeded: number;
    dealsAtRisk: number;
    campaignHighlights: string[];
    suggestedActions: AgentSuggestion[];
  };

  return {
    id: row.id,
    organizationId: row.organization_id,
    generatedAt: row.generated_at,
    summary: row.summary,
    newLeads: data.newLeads,
    followUpsNeeded: data.followUpsNeeded,
    dealsAtRisk: data.dealsAtRisk,
    campaignHighlights: data.campaignHighlights,
    suggestedActions: data.suggestedActions,
  };
}
