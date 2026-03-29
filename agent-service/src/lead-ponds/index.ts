/**
 * LeadSpot Agent Service - Lead Ponds
 *
 * Shared pools for cold/unresponsive leads that any authorized agent can claim.
 * Contacts enter ponds via auto-pond rules or manual placement, and agents
 * claim them to work fresh outreach.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../db';

// ============================================================================
// Types
// ============================================================================

export interface AutoPondRule {
  id: string;
  field: 'days_since_last_contact' | 'days_since_last_response' | 'lead_score_below' | 'no_activity_days';
  threshold: number;
  sourceStatus: string;
}

export interface LeadPond {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  maxCapacity: number; // 0 = unlimited
  currentCount: number;
  autoPondRules: AutoPondRule[];
  allowedAgentIds: string[]; // empty = all agents allowed
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PondEntry {
  id: string;
  organizationId: string;
  pondId: string;
  contactId: string;
  previousAgentId: string | null;
  reason: string;
  status: 'available' | 'claimed' | 'returned';
  claimedByAgentId: string | null;
  pondedAt: string;
  claimedAt: string | null;
  returnedAt: string | null;
  returnCount: number;
}

export interface PondStats {
  pondId: string;
  totalEntries: number;
  available: number;
  claimed: number;
  returned: number;
  highReturnCount: number; // returnCount > 3
}

// ============================================================================
// DB Schema
// ============================================================================

const tablesInitialized = new Set<string>();

function ensureTables(organizationId: string): void {
  if (tablesInitialized.has(organizationId)) return;

  const db = getDb(organizationId);
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_ponds (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      max_capacity INTEGER DEFAULT 0,
      auto_pond_rules TEXT DEFAULT '[]',
      allowed_agent_ids TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, name)
    );

    CREATE TABLE IF NOT EXISTS pond_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      pond_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      previous_agent_id TEXT,
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'available',
      claimed_by_agent_id TEXT,
      ponded_at TEXT NOT NULL,
      claimed_at TEXT,
      returned_at TEXT,
      return_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_pond_entries_org_pond_status
      ON pond_entries(organization_id, pond_id, status);

    CREATE INDEX IF NOT EXISTS idx_pond_entries_org_contact
      ON pond_entries(organization_id, contact_id);
  `);

  tablesInitialized.add(organizationId);
}

// ============================================================================
// Row Mapping
// ============================================================================

interface PondRow {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  max_capacity: number;
  auto_pond_rules: string;
  allowed_agent_ids: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface EntryRow {
  id: string;
  organization_id: string;
  pond_id: string;
  contact_id: string;
  previous_agent_id: string | null;
  reason: string;
  status: string;
  claimed_by_agent_id: string | null;
  ponded_at: string;
  claimed_at: string | null;
  returned_at: string | null;
  return_count: number;
}

function rowToPond(row: PondRow): LeadPond {
  const db_count_placeholder = 0; // Will be set by caller if needed
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    maxCapacity: row.max_capacity,
    currentCount: db_count_placeholder,
    autoPondRules: JSON.parse(row.auto_pond_rules) as AutoPondRule[],
    allowedAgentIds: JSON.parse(row.allowed_agent_ids) as string[],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEntry(row: EntryRow): PondEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    pondId: row.pond_id,
    contactId: row.contact_id,
    previousAgentId: row.previous_agent_id,
    reason: row.reason,
    status: row.status as PondEntry['status'],
    claimedByAgentId: row.claimed_by_agent_id,
    pondedAt: row.ponded_at,
    claimedAt: row.claimed_at,
    returnedAt: row.returned_at,
    returnCount: row.return_count,
  };
}

function nowISO(): string {
  return new Date().toISOString();
}

function getEntryCount(organizationId: string, pondId: string): number {
  const db = getDb(organizationId);
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM pond_entries
     WHERE organization_id = ? AND pond_id = ? AND status IN ('available', 'claimed')`,
  ).get(organizationId, pondId) as { count: number };
  return row.count;
}

function withCount(pond: LeadPond, organizationId: string): LeadPond {
  return { ...pond, currentCount: getEntryCount(organizationId, pond.id) };
}

// ============================================================================
// Pond CRUD
// ============================================================================

export function createPond(
  organizationId: string,
  name: string,
  description = '',
  maxCapacity = 0,
  autoPondRules: AutoPondRule[] = [],
  allowedAgentIds: string[] = [],
): LeadPond {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const now = nowISO();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO lead_ponds (id, organization_id, name, description, max_capacity, auto_pond_rules, allowed_agent_ids, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id, organizationId, name, description, maxCapacity,
    JSON.stringify(autoPondRules), JSON.stringify(allowedAgentIds),
    now, now,
  );

  return {
    id, organizationId, name, description, maxCapacity, currentCount: 0,
    autoPondRules, allowedAgentIds, isActive: true, createdAt: now, updatedAt: now,
  };
}

export function getPonds(organizationId: string): LeadPond[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM lead_ponds WHERE organization_id = ? ORDER BY name ASC',
  ).all(organizationId) as PondRow[];
  return rows.map((r) => withCount(rowToPond(r), organizationId));
}

export function getPond(organizationId: string, pondId: string): LeadPond | undefined {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(
    'SELECT * FROM lead_ponds WHERE organization_id = ? AND id = ?',
  ).get(organizationId, pondId) as PondRow | undefined;
  return row ? withCount(rowToPond(row), organizationId) : undefined;
}

export function updatePond(
  organizationId: string,
  pondId: string,
  updates: Partial<Pick<LeadPond, 'name' | 'description' | 'maxCapacity' | 'autoPondRules' | 'allowedAgentIds' | 'isActive'>>,
): boolean {
  ensureTables(organizationId);
  const existing = getPond(organizationId, pondId);
  if (!existing) return false;

  const merged = {
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    maxCapacity: updates.maxCapacity ?? existing.maxCapacity,
    autoPondRules: updates.autoPondRules ?? existing.autoPondRules,
    allowedAgentIds: updates.allowedAgentIds ?? existing.allowedAgentIds,
    isActive: updates.isActive ?? existing.isActive,
  };

  getDb(organizationId).prepare(`
    UPDATE lead_ponds
    SET name = ?, description = ?, max_capacity = ?, auto_pond_rules = ?,
        allowed_agent_ids = ?, is_active = ?, updated_at = ?
    WHERE organization_id = ? AND id = ?
  `).run(
    merged.name, merged.description, merged.maxCapacity,
    JSON.stringify(merged.autoPondRules), JSON.stringify(merged.allowedAgentIds),
    merged.isActive ? 1 : 0, nowISO(), organizationId, pondId,
  );
  return true;
}

export function deletePond(organizationId: string, pondId: string): boolean {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const result = db.prepare(
    'DELETE FROM lead_ponds WHERE organization_id = ? AND id = ?',
  ).run(organizationId, pondId);

  if (result.changes > 0) {
    db.prepare(
      'DELETE FROM pond_entries WHERE organization_id = ? AND pond_id = ?',
    ).run(organizationId, pondId);
    return true;
  }
  return false;
}

// ============================================================================
// Entry Management
// ============================================================================

export function addToPond(
  organizationId: string,
  pondId: string,
  contactId: string,
  reason: string,
  previousAgentId: string | null = null,
): PondEntry | null {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  // Check if contact is already in this pond with available/claimed status
  const existingEntry = db.prepare(`
    SELECT * FROM pond_entries
    WHERE organization_id = ? AND pond_id = ? AND contact_id = ? AND status IN ('available', 'claimed')
  `).get(organizationId, pondId, contactId) as EntryRow | undefined;

  if (existingEntry) return rowToEntry(existingEntry);

  // Check capacity
  const pond = getPond(organizationId, pondId);
  if (!pond) return null;
  if (pond.maxCapacity > 0 && pond.currentCount >= pond.maxCapacity) return null;

  const entry: PondEntry = {
    id: randomUUID(), organizationId, pondId, contactId,
    previousAgentId, reason, status: 'available',
    claimedByAgentId: null, pondedAt: nowISO(),
    claimedAt: null, returnedAt: null, returnCount: 0,
  };

  db.prepare(`
    INSERT INTO pond_entries
      (id, organization_id, pond_id, contact_id, previous_agent_id, reason, status,
       claimed_by_agent_id, ponded_at, claimed_at, returned_at, return_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id, organizationId, entry.pondId, entry.contactId,
    entry.previousAgentId, entry.reason, entry.status,
    entry.claimedByAgentId, entry.pondedAt,
    entry.claimedAt, entry.returnedAt, entry.returnCount,
  );

  return entry;
}

export function claimFromPond(
  organizationId: string,
  pondId: string,
  agentId: string,
  entryId?: string,
): PondEntry | null {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  // Check agent authorization
  const pond = getPond(organizationId, pondId);
  if (!pond || !pond.isActive) return null;
  if (pond.allowedAgentIds.length > 0 && !pond.allowedAgentIds.includes(agentId)) {
    return null;
  }

  // Find an available entry (specific or first available)
  let sql = `SELECT * FROM pond_entries
    WHERE organization_id = ? AND pond_id = ? AND status = 'available'`;
  const params: (string | number)[] = [organizationId, pondId];

  if (entryId) {
    sql += ' AND id = ?';
    params.push(entryId);
  }
  sql += ' LIMIT 1';

  const row = db.prepare(sql).get(...params) as EntryRow | undefined;
  if (!row) return null;

  const now = nowISO();
  db.prepare(`
    UPDATE pond_entries SET status = 'claimed', claimed_by_agent_id = ?, claimed_at = ?
    WHERE id = ? AND organization_id = ?
  `).run(agentId, now, row.id, organizationId);

  return {
    ...rowToEntry(row),
    status: 'claimed',
    claimedByAgentId: agentId,
    claimedAt: now,
  };
}

export function returnToPond(
  organizationId: string,
  entryId: string,
  reason = 'Returned by agent',
): PondEntry | null {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const row = db.prepare(
    `SELECT * FROM pond_entries WHERE id = ? AND organization_id = ? AND status = 'claimed'`,
  ).get(entryId, organizationId) as EntryRow | undefined;
  if (!row) return null;

  const now = nowISO();
  const newReturnCount = row.return_count + 1;

  db.prepare(`
    UPDATE pond_entries
    SET status = 'returned', returned_at = ?, return_count = ?,
        claimed_by_agent_id = NULL, claimed_at = NULL, reason = ?
    WHERE id = ? AND organization_id = ?
  `).run(now, newReturnCount, reason, entryId, organizationId);

  // Re-insert as available so it can be claimed again
  const reEntry: PondEntry = {
    id: randomUUID(), organizationId, pondId: row.pond_id,
    contactId: row.contact_id, previousAgentId: row.claimed_by_agent_id,
    reason, status: 'available', claimedByAgentId: null,
    pondedAt: now, claimedAt: null, returnedAt: null,
    returnCount: newReturnCount,
  };

  db.prepare(`
    INSERT INTO pond_entries
      (id, organization_id, pond_id, contact_id, previous_agent_id, reason, status,
       claimed_by_agent_id, ponded_at, claimed_at, returned_at, return_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reEntry.id, organizationId, reEntry.pondId, reEntry.contactId,
    reEntry.previousAgentId, reEntry.reason, reEntry.status,
    reEntry.claimedByAgentId, reEntry.pondedAt,
    reEntry.claimedAt, reEntry.returnedAt, reEntry.returnCount,
  );

  return reEntry;
}

export function getAvailableEntries(
  organizationId: string,
  pondId: string,
  limit = 50,
): PondEntry[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(`
    SELECT * FROM pond_entries
    WHERE organization_id = ? AND pond_id = ? AND status = 'available'
    ORDER BY ponded_at ASC LIMIT ?
  `).all(organizationId, pondId, limit) as EntryRow[];
  return rows.map(rowToEntry);
}

export function getEntryByContact(
  organizationId: string,
  contactId: string,
): PondEntry | undefined {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(`
    SELECT * FROM pond_entries
    WHERE organization_id = ? AND contact_id = ? AND status IN ('available', 'claimed')
    ORDER BY ponded_at DESC LIMIT 1
  `).get(organizationId, contactId) as EntryRow | undefined;
  return row ? rowToEntry(row) : undefined;
}

export function getPondStats(organizationId: string, pondId: string): PondStats {
  ensureTables(organizationId);
  const db = getDb(organizationId);

  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM pond_entries
    WHERE organization_id = ? AND pond_id = ?
    GROUP BY status
  `).all(organizationId, pondId) as Array<{ status: string; count: number }>;

  const highReturn = db.prepare(`
    SELECT COUNT(*) as count FROM pond_entries
    WHERE organization_id = ? AND pond_id = ? AND return_count > 3
  `).get(organizationId, pondId) as { count: number };

  const statusMap: Record<string, number> = {};
  for (const c of counts) {
    statusMap[c.status] = c.count;
  }

  return {
    pondId,
    totalEntries: (statusMap['available'] ?? 0) + (statusMap['claimed'] ?? 0) + (statusMap['returned'] ?? 0),
    available: statusMap['available'] ?? 0,
    claimed: statusMap['claimed'] ?? 0,
    returned: statusMap['returned'] ?? 0,
    highReturnCount: highReturn.count,
  };
}

// ============================================================================
// Auto-Pond Rules (Stub)
// ============================================================================

/**
 * Evaluates auto-pond rules for all ponds in an organization.
 * Scans assigned leads against each pond's rules and moves qualifying
 * contacts into the pond.
 *
 * Returns the number of entries added across all ponds.
 *
 * TODO: Integrate with LeadSpot API to fetch real contact/lead data.
 */
export function evaluateAutoPondRules(organizationId: string): number {
  ensureTables(organizationId);
  const ponds = getPonds(organizationId).filter((p) => p.isActive && p.autoPondRules.length > 0);
  let totalAdded = 0;

  for (const pond of ponds) {
    // TODO: For each rule, query real contact data from CRM:
    // - days_since_last_contact: contacts where last outbound > threshold days
    // - days_since_last_response: contacts where last inbound > threshold days
    // - lead_score_below: contacts where score < threshold
    // - no_activity_days: contacts with zero activity > threshold days
    // Then call addToPond() for each qualifying contact.
    console.log(
      `[LeadPonds] Would evaluate ${pond.autoPondRules.length} rules for pond "${pond.name}"`,
    );
    void pond; // Acknowledge usage until real implementation
  }

  return totalAdded;
}

// ============================================================================
// Default Ponds
// ============================================================================

export function createDefaultPonds(organizationId: string): void {
  ensureTables(organizationId);
  const existing = getPonds(organizationId);
  if (existing.length > 0) return;

  createPond(
    organizationId,
    'Cold Leads',
    'Leads with no activity in 30+ days. Available for any agent to re-engage.',
    0,
    [
      { id: randomUUID(), field: 'no_activity_days', threshold: 30, sourceStatus: 'active' },
      { id: randomUUID(), field: 'lead_score_below', threshold: 20, sourceStatus: 'active' },
    ],
    [],
  );

  createPond(
    organizationId,
    'Unresponsive Leads',
    'Leads that have not responded to outreach in 14+ days.',
    0,
    [
      { id: randomUUID(), field: 'days_since_last_response', threshold: 14, sourceStatus: 'active' },
    ],
    [],
  );
}
