/**
 * LeadSpot Agent Service - CRM Cron Service
 *
 * Scheduled task engine for proactive CRM intelligence:
 * - Daily pipeline briefs
 * - Follow-up reminders
 * - Stalled deal alerts
 * - Weekly reports
 *
 * Adapted from Johnny5's cron-service.ts. Uses SQLite (via db layer)
 * instead of file-based JSON storage.
 */

import { randomUUID } from 'crypto';
import { Cron } from 'croner';

import type {
  CronJob,
  CronSchedule,
  CronPayload,
  CronRunRecord,
} from '../types';
import { getDb } from '../db';

// ============================================================================
// Types
// ============================================================================

export interface CronServiceConfig {
  /** Default timezone for cron expressions */
  defaultTimezone: string;
  /** Callback invoked when a job fires. The orchestrator handles dispatching. */
  onJobRun: (job: CronJob) => Promise<string | void>;
  /** Optional notification callback */
  onNotify?: (message: string, job: CronJob) => void;
}

export const CRON_LIMITS = {
  MAX_JOBS_PER_ORG: 100,
  MIN_INTERVAL_MS: 60_000, // No faster than 1/minute
  MAX_EXECUTION_TIME_MS: 30_000, // 30 second timeout
  MAX_HISTORY_PER_JOB: 100, // Keep last 100 runs
} as const;

// ============================================================================
// Duration Helpers
// ============================================================================

export function parseDuration(duration: string): number {
  const match = duration.match(
    /^(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day)s?$/i
  );
  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Use formats like "30m", "2h", "1d"`
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1_000,
    sec: 1_000,
    second: 1_000,
    m: 60_000,
    min: 60_000,
    minute: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hour: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
  };

  return value * multipliers[unit];
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ============================================================================
// SQLite Cron Store
// ============================================================================

/** Row shape returned by SQLite for cron_jobs */
interface CronJobRow {
  id: string;
  organization_id: string;
  name: string;
  schedule: string; // JSON string
  payload: string; // JSON string
  enabled: number; // 0 or 1
  created_at: number;
  last_run: number | null;
  next_run: number | null;
  delete_after_run: number; // 0 or 1
}

/** Convert a SQLite row into a typed CronJob */
function rowToJob(row: CronJobRow): CronJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    schedule: JSON.parse(row.schedule) as CronSchedule,
    payload: JSON.parse(row.payload) as CronPayload,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    lastRun: row.last_run ?? undefined,
    nextRun: row.next_run ?? undefined,
    deleteAfterRun: row.delete_after_run === 1,
  };
}

class CronStore {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  private get db() {
    return getDb(this.organizationId);
  }

  // ---- Jobs ----

  getJobs(): CronJob[] {
    const rows = this.db
      .prepare('SELECT * FROM cron_jobs WHERE organization_id = ?')
      .all(this.organizationId) as CronJobRow[];
    return rows.map(rowToJob);
  }

  getJob(id: string): CronJob | undefined {
    const row = this.db
      .prepare('SELECT * FROM cron_jobs WHERE id = ? AND organization_id = ?')
      .get(id, this.organizationId) as CronJobRow | undefined;
    return row ? rowToJob(row) : undefined;
  }

  addJob(job: CronJob): { success: boolean; error?: string } {
    // Check org limit
    const countRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM cron_jobs WHERE organization_id = ?')
      .get(this.organizationId) as { cnt: number };

    if (countRow.cnt >= CRON_LIMITS.MAX_JOBS_PER_ORG) {
      return {
        success: false,
        error: `Maximum job limit (${CRON_LIMITS.MAX_JOBS_PER_ORG}) reached`,
      };
    }

    // Validate interval
    if (
      job.schedule.kind === 'every' &&
      job.schedule.everyMs < CRON_LIMITS.MIN_INTERVAL_MS
    ) {
      return {
        success: false,
        error: `Interval too short (minimum ${CRON_LIMITS.MIN_INTERVAL_MS / 1000} seconds)`,
      };
    }

    // Insert (UNIQUE constraint on org+name will reject duplicates)
    try {
      this.db
        .prepare(
          `INSERT INTO cron_jobs
            (id, organization_id, name, schedule, payload, enabled, created_at, last_run, next_run, delete_after_run)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          job.id,
          job.organizationId,
          job.name,
          JSON.stringify(job.schedule),
          JSON.stringify(job.payload),
          job.enabled ? 1 : 0,
          job.createdAt,
          job.lastRun ?? null,
          job.nextRun ?? null,
          job.deleteAfterRun ? 1 : 0
        );
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('UNIQUE constraint')) {
        return {
          success: false,
          error: `Job with name "${job.name}" already exists for this organization`,
        };
      }
      throw err;
    }
  }

  updateJob(id: string, updates: Partial<CronJob>): boolean {
    const existing = this.getJob(id);
    if (!existing) return false;

    const merged = { ...existing, ...updates };

    const result = this.db
      .prepare(
        `UPDATE cron_jobs
         SET name = ?, schedule = ?, payload = ?, enabled = ?,
             last_run = ?, next_run = ?, delete_after_run = ?
         WHERE id = ? AND organization_id = ?`
      )
      .run(
        merged.name,
        JSON.stringify(merged.schedule),
        JSON.stringify(merged.payload),
        merged.enabled ? 1 : 0,
        merged.lastRun ?? null,
        merged.nextRun ?? null,
        merged.deleteAfterRun ? 1 : 0,
        id,
        this.organizationId
      );

    return result.changes > 0;
  }

  removeJob(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM cron_jobs WHERE id = ? AND organization_id = ?')
      .run(id, this.organizationId);

    // Also clean up run history
    if (result.changes > 0) {
      this.db.prepare('DELETE FROM cron_runs WHERE job_id = ?').run(id);
    }

    return result.changes > 0;
  }

  // ---- Run History ----

  logRun(jobId: string, record: CronRunRecord): void {
    this.db
      .prepare(
        `INSERT INTO cron_runs (job_id, timestamp, status, duration_ms, error)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(jobId, record.timestamp, record.status, record.durationMs, record.error ?? null);

    // Prune old runs beyond limit
    this.pruneRunHistory(jobId);
  }

  getRunHistory(jobId: string, limit = 20): CronRunRecord[] {
    const rows = this.db
      .prepare(
        `SELECT timestamp, status, duration_ms, error
         FROM cron_runs
         WHERE job_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(jobId, limit) as Array<{
        timestamp: number;
        status: string;
        duration_ms: number;
        error: string | null;
      }>;

    return rows.map((row) => ({
      timestamp: row.timestamp,
      status: row.status as 'success' | 'failed',
      durationMs: row.duration_ms,
      error: row.error ?? undefined,
    }));
  }

  private pruneRunHistory(jobId: string): void {
    // Keep only the most recent MAX_HISTORY_PER_JOB runs
    this.db
      .prepare(
        `DELETE FROM cron_runs
         WHERE job_id = ? AND rowid NOT IN (
           SELECT rowid FROM cron_runs
           WHERE job_id = ?
           ORDER BY timestamp DESC
           LIMIT ?
         )`
      )
      .run(jobId, jobId, CRON_LIMITS.MAX_HISTORY_PER_JOB);
  }
}

// ============================================================================
// CRM Cron Service
// ============================================================================

export class CRMCronService {
  private stores: Map<string, CronStore> = new Map();
  private config: CronServiceConfig;
  private timers: Map<string, NodeJS.Timeout | Cron> = new Map();
  private running = false;

  constructor(config: CronServiceConfig) {
    this.config = config;
  }

  /** Get or create a CronStore for the given organization */
  private getStore(organizationId: string): CronStore {
    let store = this.stores.get(organizationId);
    if (!store) {
      store = new CronStore(organizationId);
      this.stores.set(organizationId, store);
    }
    return store;
  }

  // ============ Lifecycle ============

  /** Start the cron service for a specific organization */
  async startForOrg(organizationId: string): Promise<void> {
    this.running = true;

    const store = this.getStore(organizationId);
    const jobs = store.getJobs();

    let scheduled = 0;
    for (const job of jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
        scheduled++;
      }
    }

    console.log(
      `[CronService] Started for org ${organizationId}: ${scheduled}/${jobs.length} jobs scheduled`
    );
  }

  /** Start the cron service, loading jobs for all orgs that have stored jobs */
  async start(organizationIds: string[]): Promise<void> {
    if (this.running) return;
    this.running = true;

    for (const orgId of organizationIds) {
      await this.startForOrg(orgId);
    }

    console.log(`[CronService] Started for ${organizationIds.length} organizations`);
  }

  /** Stop the cron service and clear all timers */
  stop(): void {
    this.running = false;

    for (const [id, timer] of this.timers) {
      if (timer instanceof Cron) {
        timer.stop();
      } else {
        clearTimeout(timer);
      }
    }
    this.timers.clear();

    console.log('[CronService] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  // ============ Job Management ============

  async addJob(
    name: string,
    schedule: CronSchedule,
    payload: CronPayload,
    organizationId: string,
    options: { enabled?: boolean; deleteAfterRun?: boolean } = {}
  ): Promise<{ success: boolean; job?: CronJob; error?: string }> {
    const job: CronJob = {
      id: randomUUID(),
      name,
      schedule,
      payload,
      enabled: options.enabled ?? true,
      organizationId,
      createdAt: Date.now(),
      nextRun: this.computeNextRun(schedule),
      deleteAfterRun: options.deleteAfterRun,
    };

    const store = this.getStore(organizationId);
    const result = store.addJob(job);

    if (!result.success) {
      return result;
    }

    if (this.running && job.enabled) {
      this.scheduleJob(job);
    }

    console.log(`[CronService] Added job: ${job.name} (${job.id}) for org ${organizationId}`);
    return { success: true, job };
  }

  async addReminder(
    delay: string,
    message: string,
    organizationId: string
  ): Promise<{ success: boolean; job?: CronJob; error?: string }> {
    try {
      const delayMs = parseDuration(delay);
      const schedule: CronSchedule = { kind: 'at', atMs: Date.now() + delayMs };

      return this.addJob(
        `Reminder: ${message.slice(0, 30)}${message.length > 30 ? '...' : ''}`,
        schedule,
        { message, action: 'custom', deliver: true },
        organizationId,
        { deleteAfterRun: true }
      );
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { success: false, error: err.message };
    }
  }

  async removeJob(id: string, organizationId: string): Promise<boolean> {
    // Stop timer if running
    const timer = this.timers.get(id);
    if (timer) {
      if (timer instanceof Cron) {
        timer.stop();
      } else {
        clearTimeout(timer);
      }
      this.timers.delete(id);
    }

    const store = this.getStore(organizationId);
    const removed = store.removeJob(id);

    if (removed) {
      console.log(`[CronService] Removed job: ${id}`);
    }
    return removed;
  }

  async enableJob(id: string, organizationId: string): Promise<boolean> {
    const store = this.getStore(organizationId);
    const job = store.getJob(id);
    if (!job) return false;

    store.updateJob(id, { enabled: true });

    if (this.running) {
      this.scheduleJob({ ...job, enabled: true });
    }

    return true;
  }

  async disableJob(id: string, organizationId: string): Promise<boolean> {
    // Stop timer if running
    const timer = this.timers.get(id);
    if (timer) {
      if (timer instanceof Cron) {
        timer.stop();
      } else {
        clearTimeout(timer);
      }
      this.timers.delete(id);
    }

    const store = this.getStore(organizationId);
    return store.updateJob(id, { enabled: false });
  }

  getJobs(organizationId: string): CronJob[] {
    return this.getStore(organizationId).getJobs();
  }

  getJob(id: string, organizationId: string): CronJob | undefined {
    return this.getStore(organizationId).getJob(id);
  }

  async getJobHistory(jobId: string, organizationId: string): Promise<CronRunRecord[]> {
    return this.getStore(organizationId).getRunHistory(jobId);
  }

  // ============ Scheduling ============

  private scheduleJob(job: CronJob): void {
    // Clear existing timer if any
    const existing = this.timers.get(job.id);
    if (existing) {
      if (existing instanceof Cron) {
        existing.stop();
      } else {
        clearTimeout(existing);
      }
    }

    switch (job.schedule.kind) {
      case 'at': {
        const delay = job.schedule.atMs - Date.now();
        if (delay <= 0) {
          // Already past - run immediately
          this.runJob(job);
        } else {
          const timer = setTimeout(() => this.runJob(job), delay);
          this.timers.set(job.id, timer);
        }
        break;
      }

      case 'every': {
        const now = Date.now();
        const nextRun = job.nextRun || now;
        const delay = Math.max(0, nextRun - now);

        const runAndReschedule = (): void => {
          this.runJob(job);
          if (job.schedule.kind === 'every') {
            const timer = setTimeout(runAndReschedule, job.schedule.everyMs);
            this.timers.set(job.id, timer);
          }
        };

        const timer = setTimeout(runAndReschedule, delay);
        this.timers.set(job.id, timer);
        break;
      }

      case 'cron': {
        const cronExpr = job.schedule.expr;
        if (!cronExpr) {
          console.error(
            `[CronService] Skipping job "${job.name}": missing cron expression`
          );
          break;
        }

        const tz = job.schedule.tz || this.config.defaultTimezone;
        const cronTimer = new Cron(cronExpr, { timezone: tz }, () =>
          this.runJob(job)
        );
        this.timers.set(job.id, cronTimer);

        console.log(
          `[CronService] Scheduled cron job "${job.name}" with expression: ${cronExpr} (${tz})`
        );
        break;
      }
    }
  }

  private async runJob(job: CronJob): Promise<void> {
    const startTime = Date.now();
    let status: 'success' | 'failed' = 'success';
    let error: string | undefined;

    console.log(`[CronService] Running job: ${job.name} (org: ${job.organizationId})`);

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.executeWithTimeout(job);

        // Send notification if requested
        if (job.payload.deliver && this.config.onNotify) {
          this.config.onNotify(job.payload.message, job);
        }

        // Success - break out of retry loop
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s...
          await this.sleep(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    if (lastError) {
      status = 'failed';
      error = lastError.message;
    }

    const durationMs = Date.now() - startTime;

    // Log run to database
    const store = this.getStore(job.organizationId);
    const record: CronRunRecord = { timestamp: startTime, status, durationMs, error };
    store.logRun(job.id, record);

    // Update job metadata
    const updates: Partial<CronJob> = {
      lastRun: startTime,
      nextRun: this.computeNextRun(job.schedule),
    };
    store.updateJob(job.id, updates);

    // Delete one-shot jobs after run
    if (job.deleteAfterRun || job.schedule.kind === 'at') {
      await this.removeJob(job.id, job.organizationId);
    }

    console.log(
      `[CronService] Job "${job.name}" completed: ${status} (${durationMs}ms)`
    );
  }

  private async executeWithTimeout(job: CronJob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Job execution timed out'));
      }, CRON_LIMITS.MAX_EXECUTION_TIME_MS);

      this.config
        .onJobRun(job)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((err: unknown) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  private computeNextRun(schedule: CronSchedule): number {
    const now = Date.now();

    switch (schedule.kind) {
      case 'at':
        return schedule.atMs;

      case 'every':
        return now + schedule.everyMs;

      case 'cron': {
        try {
          const tz = schedule.tz || this.config.defaultTimezone;
          const cron = new Cron(schedule.expr, { timezone: tz });
          const next = cron.nextRun();
          cron.stop();
          return next?.getTime() || now;
        } catch {
          return now;
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ Default CRM Jobs ============

  /**
   * Create default CRM cron jobs for an organization if they don't exist.
   * These are the core proactive intelligence features.
   */
  async createDefaultJobs(
    organizationId: string,
    timezone?: string
  ): Promise<void> {
    const tz = timezone || this.config.defaultTimezone;
    const existingJobs = this.getJobs(organizationId);
    const existingNames = new Set(existingJobs.map((j) => j.name));

    // Daily Pipeline Brief at 7am
    if (!existingNames.has('Daily Pipeline Brief')) {
      await this.addJob(
        'Daily Pipeline Brief',
        { kind: 'cron', expr: '0 7 * * *', tz },
        {
          message: 'Your daily pipeline brief is ready.',
          action: 'pipeline_brief',
          deliver: true,
        },
        organizationId
      );
      console.log(
        `[CronService] Created "Daily Pipeline Brief" for org ${organizationId} (7am ${tz})`
      );
    }

    // Follow-Up Check every 4 hours during business hours Mon-Fri
    if (!existingNames.has('Follow-Up Check')) {
      await this.addJob(
        'Follow-Up Check',
        { kind: 'cron', expr: '0 8,12,16 * * 1-5', tz },
        {
          message: 'Checking for contacts that need follow-up...',
          action: 'follow_up_check',
          deliver: false,
        },
        organizationId
      );
      console.log(
        `[CronService] Created "Follow-Up Check" for org ${organizationId} (every 4h M-F ${tz})`
      );
    }

    // Stalled Deal Alert daily at 9am
    if (!existingNames.has('Stalled Deal Alert')) {
      await this.addJob(
        'Stalled Deal Alert',
        { kind: 'cron', expr: '0 9 * * *', tz },
        {
          message: 'Scanning for deals that have stalled...',
          action: 'stalled_deal_alert',
          deliver: true,
        },
        organizationId
      );
      console.log(
        `[CronService] Created "Stalled Deal Alert" for org ${organizationId} (9am daily ${tz})`
      );
    }

    // Weekly Report Friday at 5pm
    if (!existingNames.has('Weekly Report')) {
      await this.addJob(
        'Weekly Report',
        { kind: 'cron', expr: '0 17 * * 5', tz },
        {
          message: 'Your weekly CRM performance report is ready.',
          action: 'weekly_report',
          deliver: true,
        },
        organizationId
      );
      console.log(
        `[CronService] Created "Weekly Report" for org ${organizationId} (Friday 5pm ${tz})`
      );
    }
  }

  // ============ Helpers ============

  formatJobInfo(job: CronJob): string {
    let scheduleStr: string;

    switch (job.schedule.kind) {
      case 'at':
        scheduleStr = `at ${new Date(job.schedule.atMs).toLocaleString()}`;
        break;
      case 'every':
        scheduleStr = `every ${formatDuration(job.schedule.everyMs)}`;
        break;
      case 'cron':
        scheduleStr = `cron: ${job.schedule.expr}`;
        break;
    }

    const nextRunStr = job.nextRun
      ? `Next: ${new Date(job.nextRun).toLocaleString()}`
      : '';

    return `[${job.id.slice(0, 8)}] ${job.name} (${scheduleStr}) ${nextRunStr}`;
  }
}

// ============================================================================
// Factory
// ============================================================================

let cronServiceInstance: CRMCronService | null = null;

/**
 * Create (or get existing) CRMCronService instance.
 * Pass config on first call; subsequent calls return the cached instance.
 */
export function createCronService(config?: Partial<CronServiceConfig>): CRMCronService {
  if (!cronServiceInstance) {
    const fullConfig: CronServiceConfig = {
      defaultTimezone: config?.defaultTimezone || 'America/Los_Angeles',
      onJobRun: config?.onJobRun || (async (job) => {
        console.log(
          `[CronService] Executing job action: ${job.payload.action || 'custom'}`
        );
      }),
      onNotify: config?.onNotify || ((message) => {
        console.log(`[CronService] Notification: ${message}`);
      }),
    };
    cronServiceInstance = new CRMCronService(fullConfig);
  }
  return cronServiceInstance;
}

/** Stop and discard the singleton cron service instance */
export function resetCronService(): void {
  if (cronServiceInstance) {
    cronServiceInstance.stop();
    cronServiceInstance = null;
  }
}
