/**
 * LeadSpot Agent Service - Reporting & Business Intelligence
 *
 * Generates reports from existing timeline_events, routing_assignments,
 * smart_list_actions, and team_agents tables. No new data collection --
 * purely analytical queries with a lightweight cache layer.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../db';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  start: string;
  end: string;
}

export interface MarketingROIReport {
  period: DateRange;
  bySource: Array<{
    source: string;
    totalLeads: number;
    contactedLeads: number;
    closedDeals: number;
    totalDealValue: number;
    conversionRate: number;
  }>;
  totals: {
    totalLeads: number;
    totalClosed: number;
    totalValue: number;
    overallConversionRate: number;
  };
}

export interface AgentActivityReport {
  period: DateRange;
  agentId: string;
  agentName: string;
  metrics: {
    callsMade: number;
    emailsSent: number;
    textsSent: number;
    uniqueConversations: number;
    notesAdded: number;
    totalActivities: number;
    humanActivities: number;
    automatedActivities: number;
  };
}

export interface SpeedToLeadReport {
  period: DateRange;
  leaderboard: Array<{
    agentId: string;
    agentName: string;
    averageResponseMinutes: number;
    medianResponseMinutes: number;
    leadsResponded: number;
    percentUnderFiveMinutes: number;
  }>;
  orgAverage: number;
}

export interface PipelineReport {
  period: DateRange;
  byStage: Array<{
    stage: string;
    count: number;
    totalValue: number;
    avgDaysInStage: number;
    conversionRateToNext: number;
  }>;
}

export interface SmartListReport {
  period: DateRange;
  byList: Array<{
    listId: string;
    listName: string;
    totalContacts: number;
    contactsActedUpon: number;
    completionRate: number;
  }>;
}

export interface ComparisonReport {
  current: DateRange;
  previous: DateRange;
  metrics: Array<{
    label: string;
    current: number;
    previous: number;
    changePercent: number;
    trend: 'up' | 'down' | 'flat';
  }>;
}

type PeriodPreset =
  | 'today'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

type ReportType =
  | 'marketing_roi'
  | 'agent_activity'
  | 'speed_to_lead'
  | 'pipeline'
  | 'smart_list';

// ============================================================================
// Schema (report cache only)
// ============================================================================

const TABLES_INITIALIZED = new Set<string>();

function ensureTables(organizationId: string): void {
  if (TABLES_INITIALIZED.has(organizationId)) return;
  const db = getDb(organizationId);

  db.exec(`
    CREATE TABLE IF NOT EXISTS report_cache (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      report_type       TEXT NOT NULL,
      parameters        TEXT NOT NULL,
      data              TEXT NOT NULL,
      generated_at      TEXT NOT NULL,
      expires_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_report_cache
      ON report_cache(organization_id, report_type, parameters);
  `);

  TABLES_INITIALIZED.add(organizationId);
}

// ============================================================================
// Date Range Helpers
// ============================================================================

/** Get a DateRange for a named period or a custom range. */
export function getDateRange(
  period: PeriodPreset,
  custom?: DateRange
): DateRange {
  if (period === 'custom') {
    if (!custom) throw new Error('Custom period requires a DateRange');
    return custom;
  }

  const now = new Date();
  const startOfDay = (d: Date): string => {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };
  const endOfDay = (d: Date): string => {
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  };

  switch (period) {
    case 'today': {
      const s = new Date(now);
      return { start: startOfDay(s), end: endOfDay(new Date(now)) };
    }
    case 'this_week': {
      const s = new Date(now);
      s.setDate(s.getDate() - s.getDay()); // Sunday
      return { start: startOfDay(s), end: endOfDay(new Date(now)) };
    }
    case 'last_week': {
      const end = new Date(now);
      end.setDate(end.getDate() - end.getDay() - 1); // last Saturday
      const s = new Date(end);
      s.setDate(s.getDate() - 6); // previous Sunday
      return { start: startOfDay(s), end: endOfDay(end) };
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(s), end: endOfDay(new Date(now)) };
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(s), end: endOfDay(end) };
    }
    case 'last_30_days': {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      return { start: startOfDay(s), end: endOfDay(new Date(now)) };
    }
    case 'last_90_days': {
      const s = new Date(now);
      s.setDate(s.getDate() - 90);
      return { start: startOfDay(s), end: endOfDay(new Date(now)) };
    }
  }
}

/** Get the previous period of the same duration, immediately before the given range. */
export function getPreviousPeriod(range: DateRange): DateRange {
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const durationMs = endMs - startMs;

  return {
    start: new Date(startMs - durationMs).toISOString(),
    end: new Date(startMs - 1).toISOString(),
  };
}

// ============================================================================
// Cache
// ============================================================================

function cacheKey(reportType: string, params: Record<string, unknown>): string {
  return JSON.stringify({ reportType, ...params });
}

/** Retrieve a cached report if it exists and hasn't expired. */
export function getCachedReport<T>(
  organizationId: string,
  reportType: string,
  params: Record<string, unknown>
): T | null {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const key = cacheKey(reportType, params);

  const row = db
    .prepare(
      `SELECT data FROM report_cache
       WHERE organization_id = ? AND report_type = ? AND parameters = ?
         AND expires_at > datetime('now')
       ORDER BY generated_at DESC LIMIT 1`
    )
    .get(organizationId, reportType, key) as { data: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.data) as T;
}

/** Store a report in the cache with a TTL in minutes. */
export function cacheReport(
  organizationId: string,
  reportType: string,
  params: Record<string, unknown>,
  data: unknown,
  ttlMinutes: number
): void {
  ensureTables(organizationId);
  const db = getDb(organizationId);
  const key = cacheKey(reportType, params);
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMinutes * 60_000);

  db.prepare(
    `INSERT OR REPLACE INTO report_cache (id, organization_id, report_type, parameters, data, generated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    organizationId,
    reportType,
    key,
    JSON.stringify(data),
    now.toISOString(),
    expires.toISOString()
  );
}

// ============================================================================
// Utility
// ============================================================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function safeQuery<T>(
  organizationId: string,
  sql: string,
  params: (string | number)[]
): T[] {
  try {
    const db = getDb(organizationId);
    return db.prepare(sql).all(...params) as T[];
  } catch {
    // Table may not exist yet -- other modules create them
    return [];
  }
}

function safeQuerySingle<T>(
  organizationId: string,
  sql: string,
  params: (string | number)[]
): T | undefined {
  try {
    const db = getDb(organizationId);
    return db.prepare(sql).get(...params) as T | undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Report Generators
// ============================================================================

/**
 * Marketing ROI: lead source attribution from routing_assignments,
 * cross-referenced with timeline_events for contact/close metrics.
 */
export function generateMarketingROI(
  organizationId: string,
  period: PeriodPreset,
  custom?: DateRange
): MarketingROIReport {
  const range = getDateRange(period, custom);
  const cacheParams = { period, range };

  const cached = getCachedReport<MarketingROIReport>(organizationId, 'marketing_roi', cacheParams);
  if (cached) return cached;

  ensureTables(organizationId);

  // Pull routing assignments with lead_source from metadata JSON
  const assignments = safeQuery<{
    contact_id: string;
    metadata: string | null;
  }>(
    organizationId,
    `SELECT contact_id, metadata FROM routing_assignments
     WHERE organization_id = ? AND created_at BETWEEN ? AND ?`,
    [organizationId, range.start, range.end]
  );

  // Group by source
  const sourceMap = new Map<string, { contactIds: Set<string> }>();
  for (const row of assignments) {
    let source = 'unknown';
    if (row.metadata) {
      try {
        const meta = JSON.parse(row.metadata) as Record<string, string>;
        source = meta.lead_source ?? 'unknown';
      } catch { /* skip parse errors */ }
    }
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { contactIds: new Set() });
    }
    sourceMap.get(source)!.contactIds.add(row.contact_id);
  }

  const bySource: MarketingROIReport['bySource'] = [];
  let totalLeads = 0;
  let totalClosed = 0;
  let totalValue = 0;

  for (const [source, { contactIds }] of Array.from(sourceMap.entries())) {
    const ids = Array.from(contactIds);
    const contacted = countContactedLeads(organizationId, ids, range);
    const closed = countClosedDeals(organizationId, ids, range);

    const entry = {
      source,
      totalLeads: ids.length,
      contactedLeads: contacted.count,
      closedDeals: closed.count,
      totalDealValue: closed.value,
      conversionRate: ids.length > 0 ? round(closed.count / ids.length, 4) : 0,
    };

    bySource.push(entry);
    totalLeads += entry.totalLeads;
    totalClosed += entry.closedDeals;
    totalValue += entry.totalDealValue;
  }

  const report: MarketingROIReport = {
    period: range,
    bySource,
    totals: {
      totalLeads,
      totalClosed,
      totalValue,
      overallConversionRate: totalLeads > 0 ? round(totalClosed / totalLeads, 4) : 0,
    },
  };

  cacheReport(organizationId, 'marketing_roi', cacheParams, report, 15);
  return report;
}

function countContactedLeads(
  organizationId: string,
  contactIds: string[],
  range: DateRange
): { count: number } {
  if (contactIds.length === 0) return { count: 0 };
  const placeholders = contactIds.map(() => '?').join(', ');
  const row = safeQuerySingle<{ cnt: number }>(
    organizationId,
    `SELECT COUNT(DISTINCT contact_id) as cnt FROM timeline_events
     WHERE organization_id = ? AND contact_id IN (${placeholders})
       AND type IN ('call_outbound', 'email_sent', 'sms_sent')
       AND created_at BETWEEN ? AND ?`,
    [organizationId, ...contactIds, range.start, range.end]
  );
  return { count: row?.cnt ?? 0 };
}

function countClosedDeals(
  organizationId: string,
  contactIds: string[],
  range: DateRange
): { count: number; value: number } {
  if (contactIds.length === 0) return { count: 0, value: 0 };
  const placeholders = contactIds.map(() => '?').join(', ');

  // stage_changed events where metadata contains new_stage = 'closed_won'
  const rows = safeQuery<{ contact_id: string; metadata: string | null }>(
    organizationId,
    `SELECT contact_id, metadata FROM timeline_events
     WHERE organization_id = ? AND contact_id IN (${placeholders})
       AND type = 'stage_changed'
       AND created_at BETWEEN ? AND ?`,
    [organizationId, ...contactIds, range.start, range.end]
  );

  let count = 0;
  let value = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.contact_id)) continue;
    if (row.metadata) {
      try {
        const meta = JSON.parse(row.metadata) as Record<string, string>;
        if (meta.new_stage === 'closed_won') {
          count++;
          value += parseFloat(meta.deal_value ?? '0') || 0;
          seen.add(row.contact_id);
        }
      } catch { /* skip */ }
    }
  }

  return { count, value };
}

/**
 * Agent Activity: timeline events grouped by type and agent.
 * "Unique conversations" = calls where metadata.duration_seconds > 120.
 */
export function generateAgentActivity(
  organizationId: string,
  period: PeriodPreset,
  agentId?: string,
  custom?: DateRange
): AgentActivityReport[] {
  const range = getDateRange(period, custom);
  const cacheParams = { period, range, agentId };

  const cached = getCachedReport<AgentActivityReport[]>(organizationId, 'agent_activity', cacheParams);
  if (cached) return cached;

  ensureTables(organizationId);

  let agentFilter = '';
  const baseParams: (string | number)[] = [organizationId, range.start, range.end];
  if (agentId) {
    agentFilter = ' AND created_by = ?';
    baseParams.push(agentId);
  }

  // Get all agent events in period
  const rows = safeQuery<{
    created_by: string | null;
    type: string;
    source: string;
    metadata: string | null;
  }>(
    organizationId,
    `SELECT created_by, type, source, metadata FROM timeline_events
     WHERE organization_id = ? AND created_at BETWEEN ? AND ?${agentFilter}`,
    baseParams
  );

  // Get agent names
  const agentNames = new Map<string, string>();
  const agentRows = safeQuery<{ id: string; name: string }>(
    organizationId,
    `SELECT id, name FROM team_agents WHERE organization_id = ?`,
    [organizationId]
  );
  for (const a of agentRows) {
    agentNames.set(a.id, a.name);
  }

  // Group by agent
  const agentMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.created_by ?? '_system_';
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(row);
  }

  const reports: AgentActivityReport[] = [];

  for (const [aid, events] of Array.from(agentMap.entries())) {
    let callsMade = 0;
    let emailsSent = 0;
    let textsSent = 0;
    let uniqueConversations = 0;
    let notesAdded = 0;
    let humanActivities = 0;
    let automatedActivities = 0;

    for (const ev of events) {
      if (ev.type === 'call_outbound' || ev.type === 'call_inbound') {
        callsMade++;
        // Check duration for unique conversations
        if (ev.metadata) {
          try {
            const meta = JSON.parse(ev.metadata) as Record<string, string>;
            const duration = parseInt(meta.duration_seconds ?? '0', 10);
            if (duration > 120) uniqueConversations++;
          } catch { /* skip */ }
        }
      }
      if (ev.type === 'email_sent') emailsSent++;
      if (ev.type === 'sms_sent') textsSent++;
      if (ev.type === 'note_added') notesAdded++;
      if (ev.source === 'human') humanActivities++;
      if (ev.source === 'automation' || ev.source === 'ai') automatedActivities++;
    }

    reports.push({
      period: range,
      agentId: aid,
      agentName: agentNames.get(aid) ?? aid,
      metrics: {
        callsMade,
        emailsSent,
        textsSent,
        uniqueConversations,
        notesAdded,
        totalActivities: events.length,
        humanActivities,
        automatedActivities,
      },
    });
  }

  cacheReport(organizationId, 'agent_activity', cacheParams, reports, 5);
  return reports;
}

/**
 * Speed to Lead: for each contact created in the period, find the first
 * outbound event and calculate response time. Group by agent.
 */
export function generateSpeedToLead(
  organizationId: string,
  period: PeriodPreset,
  custom?: DateRange
): SpeedToLeadReport {
  const range = getDateRange(period, custom);
  const cacheParams = { period, range };

  const cached = getCachedReport<SpeedToLeadReport>(organizationId, 'speed_to_lead', cacheParams);
  if (cached) return cached;

  ensureTables(organizationId);

  // Get distinct contacts with their first event (creation proxy) in the period
  const contacts = safeQuery<{ contact_id: string; first_at: string }>(
    organizationId,
    `SELECT contact_id, MIN(created_at) as first_at FROM timeline_events
     WHERE organization_id = ? AND created_at BETWEEN ? AND ?
     GROUP BY contact_id`,
    [organizationId, range.start, range.end]
  );

  // For each contact, find the first outbound event and its agent
  const agentTimes = new Map<string, { name: string; times: number[] }>();

  for (const contact of contacts) {
    const outbound = safeQuerySingle<{
      created_at: string;
      created_by: string | null;
    }>(
      organizationId,
      `SELECT created_at, created_by FROM timeline_events
       WHERE organization_id = ? AND contact_id = ?
         AND type IN ('call_outbound', 'email_sent', 'sms_sent')
       ORDER BY created_at ASC LIMIT 1`,
      [organizationId, contact.contact_id]
    );

    if (!outbound) continue;

    const createdMs = new Date(contact.first_at).getTime();
    const outboundMs = new Date(outbound.created_at).getTime();
    const minutes = Math.max(0, Math.round((outboundMs - createdMs) / 60_000));
    const aid = outbound.created_by ?? '_system_';

    if (!agentTimes.has(aid)) {
      agentTimes.set(aid, { name: aid, times: [] });
    }
    agentTimes.get(aid)!.times.push(minutes);
  }

  // Resolve agent names
  const agentRows = safeQuery<{ id: string; name: string }>(
    organizationId,
    `SELECT id, name FROM team_agents WHERE organization_id = ?`,
    [organizationId]
  );
  const nameMap = new Map(agentRows.map((a) => [a.id, a.name]));

  const leaderboard: SpeedToLeadReport['leaderboard'] = [];
  const allTimes: number[] = [];

  for (const [aid, { times }] of Array.from(agentTimes.entries())) {
    allTimes.push(...times);
    const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    const med = median(times);
    const underFive = times.filter((t) => t < 5).length;

    leaderboard.push({
      agentId: aid,
      agentName: nameMap.get(aid) ?? aid,
      averageResponseMinutes: avg,
      medianResponseMinutes: med,
      leadsResponded: times.length,
      percentUnderFiveMinutes: round(underFive / times.length, 4),
    });
  }

  // Sort leaderboard by average response time (fastest first)
  leaderboard.sort((a, b) => a.averageResponseMinutes - b.averageResponseMinutes);

  const report: SpeedToLeadReport = {
    period: range,
    leaderboard,
    orgAverage: allTimes.length > 0
      ? Math.round(allTimes.reduce((s, t) => s + t, 0) / allTimes.length)
      : 0,
  };

  cacheReport(organizationId, 'speed_to_lead', cacheParams, report, 5);
  return report;
}

/**
 * Pipeline: stage_changed events to calculate stage durations and conversion rates.
 */
export function generatePipelineReport(
  organizationId: string,
  period: PeriodPreset,
  custom?: DateRange
): PipelineReport {
  const range = getDateRange(period, custom);
  const cacheParams = { period, range };

  const cached = getCachedReport<PipelineReport>(organizationId, 'pipeline', cacheParams);
  if (cached) return cached;

  ensureTables(organizationId);

  const stageEvents = safeQuery<{
    contact_id: string;
    metadata: string | null;
    created_at: string;
  }>(
    organizationId,
    `SELECT contact_id, metadata, created_at FROM timeline_events
     WHERE organization_id = ? AND type = 'stage_changed'
       AND created_at BETWEEN ? AND ?
     ORDER BY contact_id, created_at ASC`,
    [organizationId, range.start, range.end]
  );

  // Build stage metrics
  const stageData = new Map<string, {
    count: number;
    totalValue: number;
    daysInStage: number[];
    exited: number;
  }>();

  // Group events by contact to calculate time between stage transitions
  const byContact = new Map<string, typeof stageEvents>();
  for (const ev of stageEvents) {
    if (!byContact.has(ev.contact_id)) byContact.set(ev.contact_id, []);
    byContact.get(ev.contact_id)!.push(ev);
  }

  for (const [, events] of Array.from(byContact.entries())) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev.metadata) continue;

      let oldStage = 'unknown';
      let newStage = 'unknown';
      let dealValue = 0;

      try {
        const meta = JSON.parse(ev.metadata) as Record<string, string>;
        oldStage = meta.old_stage ?? 'unknown';
        newStage = meta.new_stage ?? 'unknown';
        dealValue = parseFloat(meta.deal_value ?? '0') || 0;
      } catch { continue; }

      if (!stageData.has(oldStage)) {
        stageData.set(oldStage, { count: 0, totalValue: 0, daysInStage: [], exited: 0 });
      }

      const data = stageData.get(oldStage)!;
      data.count++;
      data.totalValue += dealValue;
      data.exited++;

      // Calculate days in old stage using time to next transition
      if (i > 0) {
        const prevTime = new Date(events[i - 1].created_at).getTime();
        const curTime = new Date(ev.created_at).getTime();
        const days = Math.max(0, (curTime - prevTime) / 86_400_000);
        data.daysInStage.push(days);
      }

      // Also track the new stage entry
      if (!stageData.has(newStage)) {
        stageData.set(newStage, { count: 0, totalValue: 0, daysInStage: [], exited: 0 });
      }
      stageData.get(newStage)!.count++;
      stageData.get(newStage)!.totalValue += dealValue;
    }
  }

  const byStage: PipelineReport['byStage'] = [];
  for (const [stage, data] of Array.from(stageData.entries())) {
    const avgDays = data.daysInStage.length > 0
      ? round(data.daysInStage.reduce((s, d) => s + d, 0) / data.daysInStage.length, 1)
      : 0;

    byStage.push({
      stage,
      count: data.count,
      totalValue: data.totalValue,
      avgDaysInStage: avgDays,
      conversionRateToNext: data.count > 0
        ? round(data.exited / data.count, 4)
        : 0,
    });
  }

  const report: PipelineReport = { period: range, byStage };

  cacheReport(organizationId, 'pipeline', cacheParams, report, 15);
  return report;
}

/**
 * Smart List: completion rates from smart_list_actions table.
 */
export function generateSmartListReport(
  organizationId: string,
  period: PeriodPreset,
  custom?: DateRange
): SmartListReport {
  const range = getDateRange(period, custom);
  const cacheParams = { period, range };

  const cached = getCachedReport<SmartListReport>(organizationId, 'smart_list', cacheParams);
  if (cached) return cached;

  ensureTables(organizationId);

  const rows = safeQuery<{
    list_id: string;
    list_name: string;
    total_contacts: number;
    acted_upon: number;
  }>(
    organizationId,
    `SELECT
       list_id,
       list_name,
       COUNT(DISTINCT contact_id) as total_contacts,
       COUNT(DISTINCT CASE WHEN status = 'completed' THEN contact_id END) as acted_upon
     FROM smart_list_actions
     WHERE organization_id = ? AND created_at BETWEEN ? AND ?
     GROUP BY list_id, list_name`,
    [organizationId, range.start, range.end]
  );

  const byList: SmartListReport['byList'] = rows.map((r) => ({
    listId: r.list_id,
    listName: r.list_name,
    totalContacts: r.total_contacts,
    contactsActedUpon: r.acted_upon,
    completionRate: r.total_contacts > 0 ? round(r.acted_upon / r.total_contacts, 4) : 0,
  }));

  const report: SmartListReport = { period: range, byList };

  cacheReport(organizationId, 'smart_list', cacheParams, report, 5);
  return report;
}

/**
 * Comparison: run the same report for current and previous period,
 * then calculate percent changes for key metrics.
 */
export function generateComparisonReport(
  organizationId: string,
  currentPeriod: PeriodPreset,
  reportType: ReportType,
  custom?: DateRange
): ComparisonReport {
  const current = getDateRange(currentPeriod, custom);
  const previous = getPreviousPeriod(current);

  const metrics: ComparisonReport['metrics'] = [];

  function addMetric(label: string, cur: number, prev: number): void {
    const change = prev !== 0 ? round((cur - prev) / prev, 4) : cur > 0 ? 1 : 0;
    const trend: 'up' | 'down' | 'flat' =
      change > 0.001 ? 'up' : change < -0.001 ? 'down' : 'flat';
    metrics.push({ label, current: cur, previous: prev, changePercent: change, trend });
  }

  switch (reportType) {
    case 'marketing_roi': {
      const cur = generateMarketingROI(organizationId, 'custom', current);
      const prev = generateMarketingROI(organizationId, 'custom', previous);
      addMetric('Total Leads', cur.totals.totalLeads, prev.totals.totalLeads);
      addMetric('Closed Deals', cur.totals.totalClosed, prev.totals.totalClosed);
      addMetric('Total Value', cur.totals.totalValue, prev.totals.totalValue);
      addMetric('Conversion Rate', cur.totals.overallConversionRate, prev.totals.overallConversionRate);
      break;
    }
    case 'agent_activity': {
      const cur = generateAgentActivity(organizationId, 'custom', undefined, current);
      const prev = generateAgentActivity(organizationId, 'custom', undefined, previous);
      const sumMetric = (reports: AgentActivityReport[], key: keyof AgentActivityReport['metrics']): number =>
        reports.reduce((s, r) => s + r.metrics[key], 0);
      addMetric('Total Activities', sumMetric(cur, 'totalActivities'), sumMetric(prev, 'totalActivities'));
      addMetric('Calls Made', sumMetric(cur, 'callsMade'), sumMetric(prev, 'callsMade'));
      addMetric('Emails Sent', sumMetric(cur, 'emailsSent'), sumMetric(prev, 'emailsSent'));
      addMetric('Unique Conversations', sumMetric(cur, 'uniqueConversations'), sumMetric(prev, 'uniqueConversations'));
      break;
    }
    case 'speed_to_lead': {
      const cur = generateSpeedToLead(organizationId, 'custom', current);
      const prev = generateSpeedToLead(organizationId, 'custom', previous);
      addMetric('Org Average (min)', cur.orgAverage, prev.orgAverage);
      break;
    }
    case 'pipeline': {
      const cur = generatePipelineReport(organizationId, 'custom', current);
      const prev = generatePipelineReport(organizationId, 'custom', previous);
      const totalCount = (r: PipelineReport): number => r.byStage.reduce((s, st) => s + st.count, 0);
      const totalVal = (r: PipelineReport): number => r.byStage.reduce((s, st) => s + st.totalValue, 0);
      addMetric('Stage Changes', totalCount(cur), totalCount(prev));
      addMetric('Pipeline Value', totalVal(cur), totalVal(prev));
      break;
    }
    case 'smart_list': {
      const cur = generateSmartListReport(organizationId, 'custom', current);
      const prev = generateSmartListReport(organizationId, 'custom', previous);
      const totalContacts = (r: SmartListReport): number => r.byList.reduce((s, l) => s + l.totalContacts, 0);
      const totalActed = (r: SmartListReport): number => r.byList.reduce((s, l) => s + l.contactsActedUpon, 0);
      addMetric('Total Contacts', totalContacts(cur), totalContacts(prev));
      addMetric('Contacts Acted Upon', totalActed(cur), totalActed(prev));
      break;
    }
  }

  return { current, previous, metrics };
}

// ============================================================================
// Helpers
// ============================================================================

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
