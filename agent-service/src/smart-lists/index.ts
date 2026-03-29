/**
 * LeadSpot Agent Service - Smart Lists Engine
 *
 * Dynamic, saved filters that tell RE agents exactly WHO to contact each day.
 * Agents work toward "Smart List Zero" (all contacts acted upon).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../db';

// ============================================================================
// Types
// ============================================================================

export interface SmartListRule {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'neq' | 'contains' | 'not_contains' | 'between';
  value: string | number | [number, number];
}

export interface SmartList {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  rules: SmartListRule[];
  sortBy: 'priority' | 'lastContact' | 'score' | 'created';
  sortOrder: 'asc' | 'desc';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartListContact {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  score: number;
  lastContactDays: number;
  stage: string;
  suggestedAction: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export interface SmartListResult {
  list: SmartList;
  contacts: SmartListContact[];
  total: number;
  completedToday: number;
  remainingToday: number;
}

// Internal type for raw contact data before priority/action assignment
interface RawContact {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  score: number;
  lastContactDays: number;
  stage: string;
  tags: string[];
  emailOpened: number;
  emailOpenedRecent: boolean;
  formSubmitted: boolean;
  createdHoursAgo: number;
  dealStalledDays: number;
  dealValue: number;
  contacted: boolean;
}

// ============================================================================
// DB Schema
// ============================================================================

const tablesInitialized = new Set<string>();

function ensureTables(organizationId: string): void {
  if (tablesInitialized.has(organizationId)) return;

  const db = getDb(organizationId);
  db.exec(`
    CREATE TABLE IF NOT EXISTS smart_lists (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      rules TEXT NOT NULL,
      sort_by TEXT DEFAULT 'priority',
      sort_order TEXT DEFAULT 'desc',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS smart_list_actions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      list_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      acted_at TEXT NOT NULL,
      action_type TEXT DEFAULT 'contacted'
    );

    CREATE INDEX IF NOT EXISTS idx_smart_lists_org
      ON smart_lists(organization_id);

    CREATE INDEX IF NOT EXISTS idx_smart_list_actions_org_list
      ON smart_list_actions(organization_id, list_id);

    CREATE INDEX IF NOT EXISTS idx_smart_list_actions_acted_at
      ON smart_list_actions(acted_at);
  `);

  tablesInitialized.add(organizationId);
}

// ============================================================================
// CRUD Operations
// ============================================================================

export function createSmartList(
  organizationId: string,
  name: string,
  rules: SmartListRule[],
  sortBy: SmartList['sortBy'] = 'priority',
  description = ''
): SmartList {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const now = new Date().toISOString();
  const list: SmartList = {
    id: randomUUID(),
    organizationId,
    name,
    description,
    rules,
    sortBy,
    sortOrder: 'desc',
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO smart_lists (id, organization_id, name, description, rules, sort_by, sort_order, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    list.id, list.organizationId, list.name, list.description,
    JSON.stringify(list.rules), list.sortBy, list.sortOrder,
    list.isDefault ? 1 : 0, list.createdAt, list.updatedAt
  );

  return list;
}

export function getSmartLists(organizationId: string): SmartList[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const rows = db.prepare(
    'SELECT * FROM smart_lists WHERE organization_id = ? ORDER BY is_default DESC, name ASC'
  ).all(organizationId) as Record<string, unknown>[];

  return rows.map(rowToSmartList);
}

export function getSmartList(organizationId: string, listId: string): SmartList | undefined {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const row = db.prepare(
    'SELECT * FROM smart_lists WHERE organization_id = ? AND id = ?'
  ).get(organizationId, listId) as Record<string, unknown> | undefined;

  return row ? rowToSmartList(row) : undefined;
}

export function updateSmartList(
  organizationId: string,
  listId: string,
  updates: Partial<Pick<SmartList, 'name' | 'description' | 'rules' | 'sortBy' | 'sortOrder'>>
): boolean {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const existing = getSmartList(organizationId, listId);
  if (!existing) return false;

  const merged = {
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    rules: updates.rules ?? existing.rules,
    sortBy: updates.sortBy ?? existing.sortBy,
    sortOrder: updates.sortOrder ?? existing.sortOrder,
  };

  const result = db.prepare(`
    UPDATE smart_lists
    SET name = ?, description = ?, rules = ?, sort_by = ?, sort_order = ?, updated_at = ?
    WHERE organization_id = ? AND id = ?
  `).run(
    merged.name, merged.description, JSON.stringify(merged.rules),
    merged.sortBy, merged.sortOrder, new Date().toISOString(),
    organizationId, listId
  );

  return result.changes > 0;
}

export function deleteSmartList(organizationId: string, listId: string): boolean {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const result = db.prepare(
    'DELETE FROM smart_lists WHERE organization_id = ? AND id = ?'
  ).run(organizationId, listId);

  if (result.changes > 0) {
    db.prepare(
      'DELETE FROM smart_list_actions WHERE organization_id = ? AND list_id = ?'
    ).run(organizationId, listId);
    return true;
  }
  return false;
}

// ============================================================================
// Smart List Evaluation
// ============================================================================

export async function evaluateSmartList(
  organizationId: string,
  listId: string
): Promise<SmartListResult | undefined> {
  const list = getSmartList(organizationId, listId);
  if (!list) return undefined;

  // TODO: Replace with real LeadSpot API call
  // const rawContacts = await leadspotApi.getContacts(organizationId);
  const rawContacts = getMockContacts();

  const matched = rawContacts.filter((c) => matchesAllRules(c, list.rules));

  const contacts: SmartListContact[] = matched.map((c) => ({
    contactId: c.contactId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    score: c.score,
    lastContactDays: c.lastContactDays,
    stage: c.stage,
    priority: calculatePriority(c),
    suggestedAction: generateSuggestedAction(c),
  }));

  const sorted = sortContacts(contacts, list.sortBy, list.sortOrder);

  const completedToday = getCompletedTodayCount(organizationId, listId);

  return {
    list,
    contacts: sorted,
    total: sorted.length,
    completedToday,
    remainingToday: Math.max(0, sorted.length - completedToday),
  };
}

// ============================================================================
// Smart List Zero Tracking
// ============================================================================

export function markContactActedUpon(
  organizationId: string,
  listId: string,
  contactId: string
): void {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  db.prepare(`
    INSERT INTO smart_list_actions (id, organization_id, list_id, contact_id, acted_at, action_type)
    VALUES (?, ?, ?, ?, ?, 'contacted')
  `).run(randomUUID(), organizationId, listId, contactId, new Date().toISOString());
}

function getCompletedTodayCount(organizationId: string, listId: string): number {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM smart_list_actions
    WHERE organization_id = ? AND list_id = ? AND acted_at >= ?
  `).get(organizationId, listId, todayStart.toISOString()) as { count: number };

  return row.count;
}

// ============================================================================
// Default Smart Lists
// ============================================================================

export function createDefaultSmartLists(organizationId: string): void {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const now = new Date().toISOString();

  const defaults: Array<{
    name: string;
    description: string;
    rules: SmartListRule[];
    sortBy: SmartList['sortBy'];
  }> = [
    {
      name: 'Hot Leads - Contact Today',
      description: 'Leads with score > 80, recent email opens, or form submissions',
      rules: [
        { field: 'leadScore', operator: 'gt', value: 80 },
      ],
      sortBy: 'score',
    },
    {
      name: 'Follow Up Overdue',
      description: 'Active contacts with no contact in 3+ days',
      rules: [
        { field: 'lastContactDays', operator: 'gt', value: 3 },
        { field: 'stage', operator: 'neq', value: 'closed' },
      ],
      sortBy: 'lastContact',
    },
    {
      name: 'New Leads - Speed to Lead',
      description: 'Leads created in last 24h not yet contacted — speed to lead!',
      rules: [
        { field: 'createdHoursAgo', operator: 'lt', value: 24 },
        { field: 'contacted', operator: 'eq', value: 0 },
      ],
      sortBy: 'created',
    },
    {
      name: 'Nurture - Long Term',
      description: 'Long-term contacts due for a touch (14+ days)',
      rules: [
        { field: 'lastContactDays', operator: 'gt', value: 14 },
      ],
      sortBy: 'lastContact',
    },
    {
      name: 'Stalled Deals',
      description: 'Deals that haven\'t moved stages in 7+ days',
      rules: [
        { field: 'dealStalledDays', operator: 'gt', value: 7 },
      ],
      sortBy: 'score',
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO smart_lists (id, organization_id, name, description, rules, sort_by, sort_order, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const def of defaults) {
      stmt.run(
        randomUUID(), organizationId, def.name, def.description,
        JSON.stringify(def.rules), def.sortBy, 'desc', now, now
      );
    }
  });

  insertAll();
}

// ============================================================================
// Rule Matching
// ============================================================================

function matchesAllRules(contact: RawContact, rules: SmartListRule[]): boolean {
  return rules.every((rule) => matchesRule(contact, rule));
}

function matchesRule(contact: RawContact, rule: SmartListRule): boolean {
  const fieldValue = getFieldValue(contact, rule.field);
  if (fieldValue === undefined) return false;

  switch (rule.operator) {
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (rule.value as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (rule.value as number);
    case 'eq':
      return fieldValue === rule.value || String(fieldValue) === String(rule.value);
    case 'neq':
      return fieldValue !== rule.value && String(fieldValue) !== String(rule.value);
    case 'contains':
      if (Array.isArray(fieldValue)) return fieldValue.includes(String(rule.value));
      return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'not_contains':
      if (Array.isArray(fieldValue)) return !fieldValue.includes(String(rule.value));
      return !String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'between': {
      const [min, max] = rule.value as [number, number];
      return typeof fieldValue === 'number' && fieldValue >= min && fieldValue <= max;
    }
    default:
      return false;
  }
}

function getFieldValue(contact: RawContact, field: string): string | number | boolean | string[] | undefined {
  const map: Record<string, string | number | boolean | string[]> = {
    leadScore: contact.score,
    score: contact.score,
    lastContactDays: contact.lastContactDays,
    stage: contact.stage,
    tag: contact.tags,
    tags: contact.tags,
    emailOpened: contact.emailOpened,
    emailOpenedRecent: contact.emailOpenedRecent,
    formSubmitted: contact.formSubmitted,
    createdHoursAgo: contact.createdHoursAgo,
    contacted: contact.contacted ? 1 : 0,
    dealStalledDays: contact.dealStalledDays,
    dealValue: contact.dealValue,
  };
  return map[field];
}

// ============================================================================
// Priority Calculation
// ============================================================================

function calculatePriority(contact: RawContact): SmartListContact['priority'] {
  // Urgent: new lead < 1 hour, OR stale high-value contact
  if (contact.createdHoursAgo < 1 && !contact.contacted) return 'urgent';
  if (contact.lastContactDays > 7 && contact.score > 70) return 'urgent';

  // High: moderately stale with decent score, OR recent email engagement
  if (contact.emailOpenedRecent) return 'high';
  if (contact.lastContactDays > 3 && contact.score > 50) return 'high';

  // Medium: slight staleness with some score
  if (contact.lastContactDays > 1 && contact.score > 30) return 'medium';

  return 'low';
}

// ============================================================================
// Suggested Action Heuristics
// ============================================================================

function generateSuggestedAction(contact: RawContact): string {
  // New lead, not yet contacted -- speed to lead
  if (contact.createdHoursAgo < 24 && !contact.contacted) {
    return 'Call immediately - new lead, speed to lead!';
  }

  // High email engagement
  if (contact.emailOpened >= 3) {
    return `Call now - opened your email ${contact.emailOpened} times`;
  }

  // Stalled deal
  if (contact.dealStalledDays > 7) {
    return `Check in on deal - hasn't moved in ${contact.dealStalledDays} days`;
  }

  // Overdue follow up in active stage
  if (contact.lastContactDays > 5 && contact.stage !== 'closed' && contact.stage !== 'lost') {
    return `Follow up - ${contact.lastContactDays} days since last contact`;
  }

  // Long-term nurture
  if (contact.lastContactDays > 14) {
    return 'Send nurture email - due for touch';
  }

  // Recent email open (but not high engagement)
  if (contact.emailOpenedRecent) {
    return 'Follow up - recently opened your email';
  }

  return 'Review contact and reach out';
}

// ============================================================================
// Sorting
// ============================================================================

const PRIORITY_RANK: Record<SmartListContact['priority'], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortContacts(
  contacts: SmartListContact[],
  sortBy: SmartList['sortBy'],
  sortOrder: SmartList['sortOrder']
): SmartListContact[] {
  const multiplier = sortOrder === 'desc' ? -1 : 1;

  return [...contacts].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * multiplier;
      case 'lastContact':
        return (a.lastContactDays - b.lastContactDays) * multiplier;
      case 'score':
        return (a.score - b.score) * multiplier;
      case 'created':
        // Lower lastContactDays ~ more recently created (approximation for mock)
        return (a.lastContactDays - b.lastContactDays) * multiplier;
      default:
        return 0;
    }
  });
}

// ============================================================================
// Row Mapping
// ============================================================================

function rowToSmartList(row: Record<string, unknown>): SmartList {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    rules: JSON.parse(row.rules as string) as SmartListRule[],
    sortBy: row.sort_by as SmartList['sortBy'],
    sortOrder: row.sort_order as SmartList['sortOrder'],
    isDefault: row.is_default === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================================
// Mock Data (TODO: Replace with LeadSpot API integration)
// ============================================================================

function getMockContacts(): RawContact[] {
  return [
    {
      contactId: 'c-001', firstName: 'Sarah', lastName: 'Chen', email: 'sarah@example.com',
      phone: '555-0101', score: 92, lastContactDays: 1, stage: 'showing',
      tags: ['buyer', 'pre-approved'], emailOpened: 4, emailOpenedRecent: true,
      formSubmitted: true, createdHoursAgo: 2, dealStalledDays: 0, dealValue: 450000, contacted: true,
    },
    {
      contactId: 'c-002', firstName: 'Marcus', lastName: 'Johnson', email: 'marcus@example.com',
      phone: '555-0102', score: 85, lastContactDays: 5, stage: 'negotiation',
      tags: ['buyer'], emailOpened: 1, emailOpenedRecent: false,
      formSubmitted: false, createdHoursAgo: 168, dealStalledDays: 10, dealValue: 380000, contacted: true,
    },
    {
      contactId: 'c-003', firstName: 'Emily', lastName: 'Rodriguez',
      phone: '555-0103', score: 45, lastContactDays: 18, stage: 'nurture',
      tags: ['long-term', 'seller'], emailOpened: 0, emailOpenedRecent: false,
      formSubmitted: false, createdHoursAgo: 720, dealStalledDays: 0, dealValue: 0, contacted: true,
    },
    {
      contactId: 'c-004', firstName: 'James', lastName: 'Park', email: 'james@example.com',
      phone: '555-0104', score: 78, lastContactDays: 0, stage: 'new',
      tags: ['buyer', 'zillow'], emailOpened: 0, emailOpenedRecent: false,
      formSubmitted: true, createdHoursAgo: 0.5, dealStalledDays: 0, dealValue: 0, contacted: false,
    },
    {
      contactId: 'c-005', firstName: 'Lisa', lastName: 'Thompson', email: 'lisa@example.com',
      score: 62, lastContactDays: 8, stage: 'under-contract',
      tags: ['buyer'], emailOpened: 2, emailOpenedRecent: true,
      formSubmitted: false, createdHoursAgo: 480, dealStalledDays: 12, dealValue: 525000, contacted: true,
    },
    {
      contactId: 'c-006', firstName: 'David', lastName: 'Kim',
      phone: '555-0106', score: 35, lastContactDays: 4, stage: 'prospect',
      tags: ['seller'], emailOpened: 1, emailOpenedRecent: false,
      formSubmitted: false, createdHoursAgo: 336, dealStalledDays: 0, dealValue: 0, contacted: true,
    },
    {
      contactId: 'c-007', firstName: 'Ana', lastName: 'Martinez', email: 'ana@example.com',
      phone: '555-0107', score: 91, lastContactDays: 0, stage: 'new',
      tags: ['buyer', 'referral'], emailOpened: 0, emailOpenedRecent: false,
      formSubmitted: true, createdHoursAgo: 0.25, dealStalledDays: 0, dealValue: 0, contacted: false,
    },
  ];
}
