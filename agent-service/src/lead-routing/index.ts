/** LeadSpot Agent Service - Lead Routing Engine */
import { randomUUID } from 'crypto';
import { getDb } from '../db';

// --- Types ---
export type RoutingStrategy = 'round_robin' | 'first_to_claim' | 'weighted' | 'rules_based';
export type LeadSource = 'zillow' | 'realtor' | 'website' | 'referral' | 'open_house' | 'social' | 'manual' | 'other';
export type PropertyType = 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'land' | 'commercial' | 'other';

export interface TeamAgent {
  id: string; organizationId: string; userId: string; name: string; email: string;
  isActive: boolean; isOnline: boolean; maxActiveLeads: number; currentActiveLeads: number;
  weight: number; conversionRate: number; specialties: string[]; zipCodes: string[];
  priceRangeMin: number; priceRangeMax: number; createdAt: string; updatedAt: string;
}

export interface RoutingCondition {
  field: 'price_range' | 'zip_code' | 'property_type' | 'lead_source' | 'tag';
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'between' | 'in' | 'contains';
  value: string | number | string[] | [number, number];
}

export interface RoutingRule {
  id: string; organizationId: string; name: string; priority: number;
  conditions: RoutingCondition[]; assignToAgentId: string | null;
  assignToStrategy: RoutingStrategy; isActive: boolean; createdAt: string; updatedAt: string;
}

export interface RoutingConfig {
  organizationId: string; defaultStrategy: RoutingStrategy; roundRobinIndex: number;
  firstToClaimTimeoutMinutes: number; weightedMinWeight: number;
  autoReassignOnAgentLeave: boolean; maxLeadsPerAgent: number; updatedAt: string;
}

export interface RoutingAssignment {
  id: string; organizationId: string; contactId: string; assignedAgentId: string | null;
  strategy: RoutingStrategy; ruleId: string | null;
  status: 'assigned' | 'pending_claim' | 'claimed' | 'reassigned' | 'ponded';
  previousAgentId: string | null; claimExpiresAt: string | null;
  createdAt: string; claimedAt: string | null; metadata: Record<string, string>;
}

// --- DB Schema ---

const tablesInitialized = new Set<string>();

function ensureTables(organizationId: string): void {
  if (tablesInitialized.has(organizationId)) return;
  const db = getDb(organizationId);
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_agents (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
      name TEXT NOT NULL, email TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
      is_online INTEGER NOT NULL DEFAULT 0, max_active_leads INTEGER NOT NULL DEFAULT 50,
      current_active_leads INTEGER NOT NULL DEFAULT 0, weight INTEGER NOT NULL DEFAULT 50,
      conversion_rate REAL NOT NULL DEFAULT 0, specialties TEXT NOT NULL DEFAULT '[]',
      zip_codes TEXT NOT NULL DEFAULT '[]', price_range_min REAL NOT NULL DEFAULT 0,
      price_range_max REAL NOT NULL DEFAULT 999999999, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, UNIQUE(organization_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 100, conditions TEXT NOT NULL DEFAULT '[]',
      assign_to_agent_id TEXT, assign_to_strategy TEXT NOT NULL DEFAULT 'round_robin',
      is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS routing_config (
      organization_id TEXT PRIMARY KEY, default_strategy TEXT NOT NULL DEFAULT 'round_robin',
      round_robin_index INTEGER NOT NULL DEFAULT 0,
      first_to_claim_timeout_minutes INTEGER NOT NULL DEFAULT 15,
      weighted_min_weight INTEGER NOT NULL DEFAULT 10,
      auto_reassign_on_agent_leave INTEGER NOT NULL DEFAULT 1,
      max_leads_per_agent INTEGER NOT NULL DEFAULT 50, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS routing_assignments (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, contact_id TEXT NOT NULL,
      assigned_agent_id TEXT, strategy TEXT NOT NULL, rule_id TEXT,
      status TEXT NOT NULL DEFAULT 'assigned', previous_agent_id TEXT,
      claim_expires_at TEXT, created_at TEXT NOT NULL, claimed_at TEXT,
      metadata TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_routing_rules_org_priority ON routing_rules(organization_id, priority);
    CREATE INDEX IF NOT EXISTS idx_routing_assignments_org ON routing_assignments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_routing_assignments_agent ON routing_assignments(assigned_agent_id);
    CREATE INDEX IF NOT EXISTS idx_routing_assignments_contact ON routing_assignments(contact_id);
    CREATE INDEX IF NOT EXISTS idx_routing_assignments_pending ON routing_assignments(organization_id, status) WHERE status = 'pending_claim';
  `);
  tablesInitialized.add(organizationId);
}

// --- Row Mappers ---

function rowToAgent(row: Record<string, unknown>): TeamAgent {
  return {
    id: row.id as string, organizationId: row.organization_id as string,
    userId: row.user_id as string, name: row.name as string, email: row.email as string,
    isActive: row.is_active === 1, isOnline: row.is_online === 1,
    maxActiveLeads: row.max_active_leads as number, currentActiveLeads: row.current_active_leads as number,
    weight: row.weight as number, conversionRate: row.conversion_rate as number,
    specialties: JSON.parse(row.specialties as string) as string[],
    zipCodes: JSON.parse(row.zip_codes as string) as string[],
    priceRangeMin: row.price_range_min as number, priceRangeMax: row.price_range_max as number,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}

function rowToRule(row: Record<string, unknown>): RoutingRule {
  return {
    id: row.id as string, organizationId: row.organization_id as string,
    name: row.name as string, priority: row.priority as number,
    conditions: JSON.parse(row.conditions as string) as RoutingCondition[],
    assignToAgentId: (row.assign_to_agent_id as string) || null,
    assignToStrategy: row.assign_to_strategy as RoutingStrategy,
    isActive: row.is_active === 1, createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToConfig(row: Record<string, unknown>): RoutingConfig {
  return {
    organizationId: row.organization_id as string,
    defaultStrategy: row.default_strategy as RoutingStrategy,
    roundRobinIndex: row.round_robin_index as number,
    firstToClaimTimeoutMinutes: row.first_to_claim_timeout_minutes as number,
    weightedMinWeight: row.weighted_min_weight as number,
    autoReassignOnAgentLeave: row.auto_reassign_on_agent_leave === 1,
    maxLeadsPerAgent: row.max_leads_per_agent as number, updatedAt: row.updated_at as string,
  };
}

function rowToAssignment(row: Record<string, unknown>): RoutingAssignment {
  return {
    id: row.id as string, organizationId: row.organization_id as string,
    contactId: row.contact_id as string, assignedAgentId: (row.assigned_agent_id as string) || null,
    strategy: row.strategy as RoutingStrategy, ruleId: (row.rule_id as string) || null,
    status: row.status as RoutingAssignment['status'],
    previousAgentId: (row.previous_agent_id as string) || null,
    claimExpiresAt: (row.claim_expires_at as string) || null,
    createdAt: row.created_at as string, claimedAt: (row.claimed_at as string) || null,
    metadata: JSON.parse(row.metadata as string) as Record<string, string>,
  };
}

// --- Routing Config ---

export function getRoutingConfig(organizationId: string): RoutingConfig {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const row = db.prepare('SELECT * FROM routing_config WHERE organization_id = ?')
    .get(organizationId) as Record<string, unknown> | undefined;
  if (row) return rowToConfig(row);

  const now = new Date().toISOString();
  db.prepare(`INSERT INTO routing_config (organization_id, default_strategy, round_robin_index,
    first_to_claim_timeout_minutes, weighted_min_weight, auto_reassign_on_agent_leave,
    max_leads_per_agent, updated_at) VALUES (?, 'round_robin', 0, 15, 10, 1, 50, ?)`)
    .run(organizationId, now);

  return { organizationId, defaultStrategy: 'round_robin', roundRobinIndex: 0,
    firstToClaimTimeoutMinutes: 15, weightedMinWeight: 10,
    autoReassignOnAgentLeave: true, maxLeadsPerAgent: 50, updatedAt: now };
}

export function updateRoutingConfig(
  organizationId: string,
  updates: Partial<Omit<RoutingConfig, 'organizationId' | 'updatedAt'>>
): RoutingConfig {
  const current = getRoutingConfig(organizationId);
  const db = getDb(organizationId);
  const now = new Date().toISOString();
  db.prepare(`UPDATE routing_config SET default_strategy = ?, round_robin_index = ?,
    first_to_claim_timeout_minutes = ?, weighted_min_weight = ?,
    auto_reassign_on_agent_leave = ?, max_leads_per_agent = ?, updated_at = ?
    WHERE organization_id = ?`).run(
    updates.defaultStrategy ?? current.defaultStrategy,
    updates.roundRobinIndex ?? current.roundRobinIndex,
    updates.firstToClaimTimeoutMinutes ?? current.firstToClaimTimeoutMinutes,
    updates.weightedMinWeight ?? current.weightedMinWeight,
    (updates.autoReassignOnAgentLeave ?? current.autoReassignOnAgentLeave) ? 1 : 0,
    updates.maxLeadsPerAgent ?? current.maxLeadsPerAgent, now, organizationId);
  return getRoutingConfig(organizationId);
}

// --- Team Agents CRUD ---

export function addTeamAgent(
  organizationId: string,
  data: Pick<TeamAgent, 'userId' | 'name' | 'email'> & Partial<Omit<TeamAgent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>
): TeamAgent {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`INSERT INTO team_agents (id, organization_id, user_id, name, email, is_active,
    is_online, max_active_leads, current_active_leads, weight, conversion_rate, specialties,
    zip_codes, price_range_min, price_range_max, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, organizationId, data.userId, data.name, data.email,
    (data.isActive ?? true) ? 1 : 0, (data.isOnline ?? false) ? 1 : 0,
    data.maxActiveLeads ?? 50, data.currentActiveLeads ?? 0, data.weight ?? 50,
    data.conversionRate ?? 0, JSON.stringify(data.specialties ?? []),
    JSON.stringify(data.zipCodes ?? []), data.priceRangeMin ?? 0,
    data.priceRangeMax ?? 999999999, now, now);
  return getTeamAgent(organizationId, id)!;
}

export function getTeamAgents(organizationId: string): TeamAgent[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM team_agents WHERE organization_id = ? ORDER BY name ASC'
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(rowToAgent);
}

export function getTeamAgent(organizationId: string, agentId: string): TeamAgent | undefined {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(
    'SELECT * FROM team_agents WHERE organization_id = ? AND id = ?'
  ).get(organizationId, agentId) as Record<string, unknown> | undefined;
  return row ? rowToAgent(row) : undefined;
}

export function updateTeamAgent(
  organizationId: string, agentId: string,
  updates: Partial<Omit<TeamAgent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>
): TeamAgent | undefined {
  ensureTables(organizationId);
  const existing = getTeamAgent(organizationId, agentId);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  getDb(organizationId).prepare(`UPDATE team_agents SET name = ?, email = ?, is_active = ?,
    is_online = ?, max_active_leads = ?, current_active_leads = ?, weight = ?,
    conversion_rate = ?, specialties = ?, zip_codes = ?, price_range_min = ?,
    price_range_max = ?, updated_at = ? WHERE organization_id = ? AND id = ?`).run(
    updates.name ?? existing.name, updates.email ?? existing.email,
    (updates.isActive ?? existing.isActive) ? 1 : 0,
    (updates.isOnline ?? existing.isOnline) ? 1 : 0,
    updates.maxActiveLeads ?? existing.maxActiveLeads,
    updates.currentActiveLeads ?? existing.currentActiveLeads,
    updates.weight ?? existing.weight, updates.conversionRate ?? existing.conversionRate,
    JSON.stringify(updates.specialties ?? existing.specialties),
    JSON.stringify(updates.zipCodes ?? existing.zipCodes),
    updates.priceRangeMin ?? existing.priceRangeMin,
    updates.priceRangeMax ?? existing.priceRangeMax, now, organizationId, agentId);
  return getTeamAgent(organizationId, agentId);
}

export function removeTeamAgent(organizationId: string, agentId: string): boolean {
  ensureTables(organizationId);
  return getDb(organizationId).prepare(
    'DELETE FROM team_agents WHERE organization_id = ? AND id = ?'
  ).run(organizationId, agentId).changes > 0;
}

export function setAgentOnlineStatus(organizationId: string, agentId: string, isOnline: boolean): boolean {
  ensureTables(organizationId);
  return getDb(organizationId).prepare(
    'UPDATE team_agents SET is_online = ?, updated_at = ? WHERE organization_id = ? AND id = ?'
  ).run(isOnline ? 1 : 0, new Date().toISOString(), organizationId, agentId).changes > 0;
}

// --- Routing Rules CRUD ---

export function createRoutingRule(
  organizationId: string,
  data: Pick<RoutingRule, 'name' | 'conditions'> & Partial<Pick<RoutingRule, 'priority' | 'assignToAgentId' | 'assignToStrategy' | 'isActive'>>
): RoutingRule {
  ensureTables(organizationId);
  const now = new Date().toISOString();
  const id = randomUUID();
  getDb(organizationId).prepare(`INSERT INTO routing_rules (id, organization_id, name, priority,
    conditions, assign_to_agent_id, assign_to_strategy, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, organizationId, data.name, data.priority ?? 100, JSON.stringify(data.conditions),
    data.assignToAgentId ?? null, data.assignToStrategy ?? 'round_robin',
    (data.isActive ?? true) ? 1 : 0, now, now);
  return getRoutingRules(organizationId).find((r) => r.id === id)!;
}

export function getRoutingRules(organizationId: string): RoutingRule[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM routing_rules WHERE organization_id = ? ORDER BY priority ASC'
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(rowToRule);
}

export function updateRoutingRule(
  organizationId: string, ruleId: string,
  updates: Partial<Omit<RoutingRule, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>
): boolean {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(
    'SELECT * FROM routing_rules WHERE organization_id = ? AND id = ?'
  ).get(organizationId, ruleId) as Record<string, unknown> | undefined;
  if (!row) return false;
  const existing = rowToRule(row);
  const now = new Date().toISOString();
  getDb(organizationId).prepare(`UPDATE routing_rules SET name = ?, priority = ?, conditions = ?,
    assign_to_agent_id = ?, assign_to_strategy = ?, is_active = ?, updated_at = ?
    WHERE organization_id = ? AND id = ?`).run(
    updates.name ?? existing.name, updates.priority ?? existing.priority,
    JSON.stringify(updates.conditions ?? existing.conditions),
    updates.assignToAgentId !== undefined ? updates.assignToAgentId : existing.assignToAgentId,
    updates.assignToStrategy ?? existing.assignToStrategy,
    (updates.isActive ?? existing.isActive) ? 1 : 0, now, organizationId, ruleId);
  return true;
}

export function deleteRoutingRule(organizationId: string, ruleId: string): boolean {
  ensureTables(organizationId);
  return getDb(organizationId).prepare(
    'DELETE FROM routing_rules WHERE organization_id = ? AND id = ?'
  ).run(organizationId, ruleId).changes > 0;
}

// --- Condition Matching ---

function matchesConditions(metadata: Record<string, string>, conditions: RoutingCondition[]): boolean {
  return conditions.every((cond) => matchesSingleCondition(metadata, cond));
}

function matchesSingleCondition(metadata: Record<string, string>, cond: RoutingCondition): boolean {
  const rawValue = metadata[cond.field];
  if (rawValue === undefined) return false;
  switch (cond.operator) {
    case 'eq': return rawValue === String(cond.value);
    case 'neq': return rawValue !== String(cond.value);
    case 'gt': return Number(rawValue) > Number(cond.value);
    case 'lt': return Number(rawValue) < Number(cond.value);
    case 'between': {
      const [min, max] = cond.value as [number, number];
      const num = Number(rawValue);
      return num >= min && num <= max;
    }
    case 'in': return (cond.value as string[]).includes(rawValue);
    case 'contains': return rawValue.toLowerCase().includes(String(cond.value).toLowerCase());
    default: return false;
  }
}

// --- Eligible Agents ---

function getEligibleAgents(organizationId: string, config: RoutingConfig, requireOnline: boolean): TeamAgent[] {
  return getTeamAgents(organizationId).filter((a) =>
    a.isActive && (!requireOnline || a.isOnline) &&
    a.currentActiveLeads < config.maxLeadsPerAgent && a.currentActiveLeads < a.maxActiveLeads
  );
}

// --- Internal Routing Strategies ---

function routeRoundRobin(organizationId: string, eligible: TeamAgent[], config: RoutingConfig): TeamAgent | null {
  if (eligible.length === 0) return null;
  const index = config.roundRobinIndex % eligible.length;
  const selected = eligible[index];
  getDb(organizationId).prepare('UPDATE routing_config SET round_robin_index = ? WHERE organization_id = ?')
    .run(config.roundRobinIndex + 1, organizationId);
  return selected ?? null;
}

function routeWeighted(eligible: TeamAgent[], minWeight: number): TeamAgent | null {
  const candidates = eligible.filter((a) => a.weight >= minWeight);
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;
  for (const agent of candidates) {
    random -= agent.weight;
    if (random <= 0) return agent;
  }
  return candidates[candidates.length - 1] ?? null;
}

function routeByRules(
  organizationId: string, metadata: Record<string, string>, config: RoutingConfig
): { agent: TeamAgent | null; ruleId: string; strategy: RoutingStrategy } | null {
  const rules = getRoutingRules(organizationId).filter((r) => r.isActive);
  for (const rule of rules) {
    if (!matchesConditions(metadata, rule.conditions)) continue;

    if (rule.assignToAgentId) {
      const agent = getTeamAgent(organizationId, rule.assignToAgentId);
      if (agent && agent.isActive && agent.currentActiveLeads < config.maxLeadsPerAgent) {
        return { agent, ruleId: rule.id, strategy: 'rules_based' };
      }
    }

    const eligible = getEligibleAgents(organizationId, config, rule.assignToStrategy === 'first_to_claim');
    let agent: TeamAgent | null = null;
    switch (rule.assignToStrategy) {
      case 'round_robin': agent = routeRoundRobin(organizationId, eligible, config); break;
      case 'weighted': agent = routeWeighted(eligible, config.weightedMinWeight); break;
      case 'first_to_claim': return { agent: null, ruleId: rule.id, strategy: 'first_to_claim' };
      default: agent = routeRoundRobin(organizationId, eligible, config);
    }
    return { agent, ruleId: rule.id, strategy: rule.assignToStrategy };
  }
  return null;
}

// --- Core Routing Engine ---

export function routeLead(
  organizationId: string, contactId: string, leadMetadata: Record<string, string>
): RoutingAssignment {
  ensureTables(organizationId);
  const config = getRoutingConfig(organizationId);
  const db = getDb(organizationId);
  const now = new Date().toISOString();

  let assignedAgent: TeamAgent | null = null;
  let ruleId: string | null = null;
  let strategy: RoutingStrategy = config.defaultStrategy;
  let status: RoutingAssignment['status'] = 'assigned';
  let claimExpiresAt: string | null = null;

  // Step 1: Try rules-based routing (priority order, first match wins)
  const ruleResult = routeByRules(organizationId, leadMetadata, config);
  if (ruleResult) {
    assignedAgent = ruleResult.agent;
    ruleId = ruleResult.ruleId;
    strategy = ruleResult.strategy;
  } else {
    // Step 2: Fall back to default strategy
    const requireOnline = config.defaultStrategy === 'first_to_claim';
    const eligible = getEligibleAgents(organizationId, config, requireOnline);
    switch (config.defaultStrategy) {
      case 'round_robin': assignedAgent = routeRoundRobin(organizationId, eligible, config); break;
      case 'weighted': assignedAgent = routeWeighted(eligible, config.weightedMinWeight); break;
      case 'first_to_claim': break; // all eligible can claim
      case 'rules_based':
        assignedAgent = routeRoundRobin(organizationId, eligible, config);
        strategy = 'round_robin';
        break;
    }
  }

  // Handle first-to-claim or no agent available
  if (strategy === 'first_to_claim' || !assignedAgent) {
    status = 'pending_claim';
    claimExpiresAt = new Date(Date.now() + config.firstToClaimTimeoutMinutes * 60_000).toISOString();
  }

  // Step 3: Create assignment record
  const assignmentId = randomUUID();
  db.prepare(`INSERT INTO routing_assignments (id, organization_id, contact_id, assigned_agent_id,
    strategy, rule_id, status, previous_agent_id, claim_expires_at, created_at, claimed_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    assignmentId, organizationId, contactId, assignedAgent?.id ?? null,
    strategy, ruleId, status, null, claimExpiresAt, now, null, JSON.stringify(leadMetadata));

  // Step 4: Increment agent's active lead count
  if (assignedAgent && status === 'assigned') {
    db.prepare('UPDATE team_agents SET current_active_leads = current_active_leads + 1, updated_at = ? WHERE id = ?')
      .run(now, assignedAgent.id);
  }
  return getAssignment(organizationId, assignmentId)!;
}

// --- Assignment Management ---

export function getAssignment(organizationId: string, assignmentId: string): RoutingAssignment | undefined {
  ensureTables(organizationId);
  const row = getDb(organizationId).prepare(
    'SELECT * FROM routing_assignments WHERE organization_id = ? AND id = ?'
  ).get(organizationId, assignmentId) as Record<string, unknown> | undefined;
  return row ? rowToAssignment(row) : undefined;
}

export function getAssignmentsForAgent(organizationId: string, agentId: string): RoutingAssignment[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM routing_assignments WHERE organization_id = ? AND assigned_agent_id = ? ORDER BY created_at DESC'
  ).all(organizationId, agentId) as Record<string, unknown>[];
  return rows.map(rowToAssignment);
}

export function getAssignmentsForContact(organizationId: string, contactId: string): RoutingAssignment[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM routing_assignments WHERE organization_id = ? AND contact_id = ? ORDER BY created_at DESC'
  ).all(organizationId, contactId) as Record<string, unknown>[];
  return rows.map(rowToAssignment);
}

export function getRoutingHistory(organizationId: string, limit = 50): RoutingAssignment[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    'SELECT * FROM routing_assignments WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(organizationId, limit) as Record<string, unknown>[];
  return rows.map(rowToAssignment);
}

// --- First-to-Claim ---

export function claimLead(organizationId: string, assignmentId: string, agentId: string): RoutingAssignment | undefined {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const assignment = getAssignment(organizationId, assignmentId);
  if (!assignment || assignment.status !== 'pending_claim') return undefined;
  if (assignment.claimExpiresAt && new Date(assignment.claimExpiresAt) < new Date()) return undefined;

  const agent = getTeamAgent(organizationId, agentId);
  if (!agent || !agent.isActive) return undefined;
  const config = getRoutingConfig(organizationId);
  if (agent.currentActiveLeads >= config.maxLeadsPerAgent) return undefined;

  const now = new Date().toISOString();
  db.prepare(`UPDATE routing_assignments SET assigned_agent_id = ?, status = 'claimed',
    claimed_at = ?, previous_agent_id = ? WHERE id = ? AND organization_id = ?`)
    .run(agentId, now, assignment.assignedAgentId, assignmentId, organizationId);
  db.prepare('UPDATE team_agents SET current_active_leads = current_active_leads + 1, updated_at = ? WHERE id = ?')
    .run(now, agentId);
  return getAssignment(organizationId, assignmentId);
}

export function getUnclaimedLeads(organizationId: string): RoutingAssignment[] {
  ensureTables(organizationId);
  const rows = getDb(organizationId).prepare(
    "SELECT * FROM routing_assignments WHERE organization_id = ? AND status = 'pending_claim' ORDER BY created_at ASC"
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(rowToAssignment);
}

export function processExpiredClaims(organizationId: string): RoutingAssignment[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const now = new Date().toISOString();
  const config = getRoutingConfig(organizationId);
  const reassigned: RoutingAssignment[] = [];

  const expired = db.prepare(
    "SELECT * FROM routing_assignments WHERE organization_id = ? AND status = 'pending_claim' AND claim_expires_at < ?"
  ).all(organizationId, now) as Record<string, unknown>[];

  for (const row of expired) {
    const assignment = rowToAssignment(row);
    const eligible = getEligibleAgents(organizationId, config, false);
    const agent = routeRoundRobin(organizationId, eligible, config);
    if (agent) {
      db.prepare(`UPDATE routing_assignments SET assigned_agent_id = ?, status = 'reassigned',
        previous_agent_id = ? WHERE id = ?`).run(agent.id, assignment.assignedAgentId, assignment.id);
      db.prepare('UPDATE team_agents SET current_active_leads = current_active_leads + 1, updated_at = ? WHERE id = ?')
        .run(now, agent.id);
    } else {
      db.prepare("UPDATE routing_assignments SET status = 'ponded' WHERE id = ?").run(assignment.id);
    }
    const updated = getAssignment(organizationId, assignment.id);
    if (updated) reassigned.push(updated);
  }
  return reassigned;
}

// --- Agent Departure ---

export function handleAgentDeparture(
  organizationId: string, agentId: string, strategy: 'round_robin' | 'pond'
): RoutingAssignment[] {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const config = getRoutingConfig(organizationId);
  const now = new Date().toISOString();
  const affected: RoutingAssignment[] = [];

  // Mark agent as inactive and offline
  db.prepare('UPDATE team_agents SET is_active = 0, is_online = 0, updated_at = ? WHERE organization_id = ? AND id = ?')
    .run(now, organizationId, agentId);

  const rows = db.prepare(
    "SELECT * FROM routing_assignments WHERE organization_id = ? AND assigned_agent_id = ? AND status IN ('assigned', 'claimed')"
  ).all(organizationId, agentId) as Record<string, unknown>[];

  for (const row of rows) {
    const assignment = rowToAssignment(row);
    if (strategy === 'pond') {
      db.prepare("UPDATE routing_assignments SET status = 'ponded', previous_agent_id = ? WHERE id = ?")
        .run(agentId, assignment.id);
    } else {
      const eligible = getEligibleAgents(organizationId, config, false);
      const newAgent = routeRoundRobin(organizationId, eligible, config);
      if (newAgent) {
        db.prepare(`UPDATE routing_assignments SET assigned_agent_id = ?, status = 'reassigned',
          previous_agent_id = ? WHERE id = ?`).run(newAgent.id, agentId, assignment.id);
        db.prepare('UPDATE team_agents SET current_active_leads = current_active_leads + 1, updated_at = ? WHERE id = ?')
          .run(now, newAgent.id);
      } else {
        db.prepare("UPDATE routing_assignments SET status = 'ponded', previous_agent_id = ? WHERE id = ?")
          .run(agentId, assignment.id);
      }
    }
    const updated = getAssignment(organizationId, assignment.id);
    if (updated) affected.push(updated);
  }

  // Reset departing agent's active lead count
  db.prepare('UPDATE team_agents SET current_active_leads = 0, updated_at = ? WHERE organization_id = ? AND id = ?')
    .run(now, organizationId, agentId);
  return affected;
}
