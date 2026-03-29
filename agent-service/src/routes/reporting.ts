/**
 * LeadSpot Agent Service - Reporting Routes
 *
 * Express routes for generating CRM reports: marketing ROI, agent activity,
 * speed-to-lead, pipeline health, smart list completion, and period comparison.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  generateMarketingROI,
  generateAgentActivity,
  generateSpeedToLead,
  generatePipelineReport,
  generateSmartListReport,
  generateComparisonReport,
  getDateRange,
  type DateRange,
} from '../reporting';

// ============================================================================
// Types
// ============================================================================

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

const VALID_PERIODS: ReadonlySet<string> = new Set<string>([
  'today', 'this_week', 'last_week', 'this_month',
  'last_month', 'last_30_days', 'last_90_days', 'custom',
]);

const VALID_REPORT_TYPES: ReadonlySet<string> = new Set<string>([
  'marketing_roi', 'agent_activity', 'speed_to_lead', 'pipeline', 'smart_list',
]);

// ============================================================================
// Helpers
// ============================================================================

interface ApiError extends Error {
  statusCode?: number;
}

function createApiError(message: string, statusCode: number): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** Extract and validate common query params shared by all report endpoints. */
function extractReportParams(req: Request): {
  organizationId: string;
  period: PeriodPreset;
  custom: DateRange | undefined;
} {
  const organizationId = req.query.organizationId as string | undefined;
  const periodRaw = req.query.period as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  if (!organizationId) {
    throw createApiError('organizationId query parameter is required', 400);
  }

  if (!periodRaw || !VALID_PERIODS.has(String(periodRaw))) {
    throw createApiError(
      `period query parameter is required and must be one of: ${Array.from(VALID_PERIODS).join(', ')}`,
      400,
    );
  }

  const period = String(periodRaw) as PeriodPreset;

  let custom: DateRange | undefined;
  if (period === 'custom') {
    if (!startDate || !endDate) {
      throw createApiError('startDate and endDate are required for custom period', 400);
    }
    custom = { start: String(startDate), end: String(endDate) };
  }

  return { organizationId: String(organizationId), period, custom };
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerReportingRoutes(router: Router): void {
  // --------------------------------------------------------------------------
  // GET /reports/marketing-roi
  // --------------------------------------------------------------------------

  router.get('/reports/marketing-roi', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, period, custom } = extractReportParams(req);
      const report = generateMarketingROI(organizationId, period, custom);
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // GET /reports/agent-activity
  // --------------------------------------------------------------------------

  router.get('/reports/agent-activity', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, period, custom } = extractReportParams(req);
      const agentId = req.query.agentId as string | undefined;

      const reports = generateAgentActivity(
        organizationId,
        period,
        agentId ? String(agentId) : undefined,
        custom,
      );

      res.json({ reports });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // GET /reports/speed-to-lead
  // --------------------------------------------------------------------------

  router.get('/reports/speed-to-lead', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, period, custom } = extractReportParams(req);
      const report = generateSpeedToLead(organizationId, period, custom);
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // GET /reports/pipeline
  // --------------------------------------------------------------------------

  router.get('/reports/pipeline', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, period, custom } = extractReportParams(req);
      const report = generatePipelineReport(organizationId, period, custom);
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // GET /reports/smart-lists
  // --------------------------------------------------------------------------

  router.get('/reports/smart-lists', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, period, custom } = extractReportParams(req);
      const report = generateSmartListReport(organizationId, period, custom);
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // GET /reports/comparison
  // --------------------------------------------------------------------------

  router.get('/reports/comparison', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, period, custom } = extractReportParams(req);
      const reportTypeRaw = req.query.reportType as string | undefined;

      if (!reportTypeRaw || !VALID_REPORT_TYPES.has(String(reportTypeRaw))) {
        throw createApiError(
          `reportType query parameter is required and must be one of: ${Array.from(VALID_REPORT_TYPES).join(', ')}`,
          400,
        );
      }

      const reportType = String(reportTypeRaw) as ReportType;
      const report = generateComparisonReport(organizationId, period, reportType, custom);

      res.json({ report });
    } catch (err) {
      next(err);
    }
  });
}
