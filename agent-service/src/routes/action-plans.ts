/**
 * LeadSpot Agent Service - Action Plan Routes
 *
 * Express routes for action plan CRUD, enrollment management,
 * and auto-pause configuration.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createActionPlan,
  getActionPlans,
  getActionPlan,
  updateActionPlan,
  deleteActionPlan,
  enrollContact,
  getEnrollments,
  pauseEnrollment,
  resumeEnrollment,
  cancelEnrollment,
  createDefaultPlans,
} from '../action-plans';
import {
  getAutoPauseConfig,
  setAutoPauseConfig,
  getPauseEvents,
} from '../action-plans/auto-pause';
import type { ActionPlan, ActionStep, ActionPlanEnrollment } from '../action-plans';
import type { AutoPauseConfig } from '../action-plans/auto-pause';

// ============================================================================
// Error Helper
// ============================================================================

interface ApiError extends Error {
  statusCode?: number;
}

function createApiError(message: string, statusCode: number): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ============================================================================
// Routes
// ============================================================================

export function registerActionPlanRoutes(router: Router): void {
  // GET /action-plans — list all action plans for an organization
  router.get('/action-plans', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const plans = getActionPlans(organizationId);
      res.json({ plans, total: plans.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /action-plans/enrollments — list enrollments (must be before :id routes)
  router.get('/action-plans/enrollments', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const options: {
        planId?: string;
        contactId?: string;
        status?: ActionPlanEnrollment['status'];
      } = {};

      if (req.query.planId) options.planId = String(req.query.planId);
      if (req.query.contactId) options.contactId = String(req.query.contactId);
      if (req.query.status) options.status = String(req.query.status) as ActionPlanEnrollment['status'];

      const enrollments = getEnrollments(organizationId, options);
      res.json({ enrollments, total: enrollments.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /action-plans/:id — get a single action plan
  router.get('/action-plans/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const plan = getActionPlan(organizationId, String(req.params.id));
      if (!plan) {
        throw createApiError('Action plan not found', 404);
      }

      res.json({ plan });
    } catch (err) {
      next(err);
    }
  });

  // POST /action-plans — create a new action plan
  router.post('/action-plans', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        name?: string;
        triggerType?: ActionPlan['triggerType'];
        steps?: ActionStep[];
        description?: string;
        triggerValue?: string;
      };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }
      if (!body.name) {
        throw createApiError('name is required', 400);
      }
      if (!body.triggerType) {
        throw createApiError('triggerType is required', 400);
      }
      if (!body.steps || !Array.isArray(body.steps)) {
        throw createApiError('steps array is required', 400);
      }

      const plan = createActionPlan(
        body.organizationId,
        body.name,
        body.triggerType,
        body.steps,
        body.description,
        body.triggerValue,
      );

      res.status(201).json({ plan });
    } catch (err) {
      next(err);
    }
  });

  // PUT /action-plans/:id — update an existing action plan
  router.put('/action-plans/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        name?: string;
        description?: string;
        triggerType?: ActionPlan['triggerType'];
        triggerValue?: string;
        steps?: ActionStep[];
        isActive?: boolean;
      };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const { organizationId, ...updates } = body;
      const success = updateActionPlan(organizationId, String(req.params.id), updates);

      if (!success) {
        throw createApiError('Action plan not found', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /action-plans/:id — delete an action plan
  router.delete('/action-plans/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const success = deleteActionPlan(organizationId, String(req.params.id));
      if (!success) {
        throw createApiError('Action plan not found', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /action-plans/:id/enroll — enroll a contact in an action plan
  router.post('/action-plans/:id/enroll', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string; contactId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }
      if (!body.contactId) {
        throw createApiError('contactId is required', 400);
      }

      const enrollment = enrollContact(
        body.organizationId,
        String(req.params.id),
        body.contactId,
      );

      res.status(201).json({ enrollment });
    } catch (err) {
      next(err);
    }
  });

  // POST /action-plans/enrollments/:id/pause — pause an enrollment
  router.post('/action-plans/enrollments/:id/pause', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const success = pauseEnrollment(body.organizationId, String(req.params.id));
      if (!success) {
        throw createApiError('Enrollment not found or not active', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /action-plans/enrollments/:id/resume — resume a paused enrollment
  router.post('/action-plans/enrollments/:id/resume', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const success = resumeEnrollment(body.organizationId, String(req.params.id));
      if (!success) {
        throw createApiError('Enrollment not found or not paused', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /action-plans/enrollments/:id/cancel — cancel an enrollment
  router.post('/action-plans/enrollments/:id/cancel', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const success = cancelEnrollment(body.organizationId, String(req.params.id));
      if (!success) {
        throw createApiError('Enrollment not found or already terminal', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /action-plans/defaults — create default action plans
  router.post('/action-plans/defaults', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      createDefaultPlans(body.organizationId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // GET /action-plans/:id/auto-pause — get auto-pause config for a plan
  router.get('/action-plans/:id/auto-pause', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const config = getAutoPauseConfig(organizationId, String(req.params.id));
      res.json({ config: config ?? null });
    } catch (err) {
      next(err);
    }
  });

  // PUT /action-plans/:id/auto-pause — set auto-pause config for a plan
  router.put('/action-plans/:id/auto-pause', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Partial<AutoPauseConfig> & { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const config: AutoPauseConfig = {
        planId: String(req.params.id),
        organizationId: body.organizationId,
        enabled: body.enabled ?? true,
        pauseOnEmailReply: body.pauseOnEmailReply ?? true,
        pauseOnSmsReply: body.pauseOnSmsReply ?? true,
        pauseOnInboundCall: body.pauseOnInboundCall ?? true,
        pauseOnCrossChannel: body.pauseOnCrossChannel ?? false,
        ignoreAutoReplies: body.ignoreAutoReplies ?? true,
        resumeRequiresHumanReview: body.resumeRequiresHumanReview ?? false,
        autoResumeAfterHours: body.autoResumeAfterHours ?? null,
      };

      setAutoPauseConfig(config);
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  // GET /action-plans/enrollments/:id/pause-history — get pause events for an enrollment
  router.get('/action-plans/enrollments/:id/pause-history', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      // getPauseEvents filters by contactId/planId/status, but for enrollment-level
      // history we fetch all for the org and filter by enrollment ID client-side.
      // For efficiency, we use the enrollment's contactId to narrow the query.
      const allEvents = getPauseEvents(organizationId);
      const enrollmentId = String(req.params.id);
      const events = allEvents.filter((e) => e.enrollmentId === enrollmentId);

      res.json({ events });
    } catch (err) {
      next(err);
    }
  });
}
