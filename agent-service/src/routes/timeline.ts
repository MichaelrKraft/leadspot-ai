/**
 * LeadSpot Agent Service - Timeline Routes
 *
 * Express route handlers for the contact timeline: event logging,
 * timeline queries, AI summaries, recent activity, and speed-to-lead.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  logEvent,
  getTimeline,
  getTimelineSummary,
  getRecentActivity,
  getSpeedToLead,
  getAverageSpeedToLead,
} from '../timeline';
import type { TimelineEventType } from '../timeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApiError extends Error {
  statusCode?: number;
}

function createApiError(message: string, statusCode: number): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export function registerTimelineRoutes(router: Router): void {
  // ---- Log Event ----

  router.post('/timeline/log', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        contactId?: string;
        type?: TimelineEventType;
        title?: string;
        description?: string;
        metadata?: Record<string, string>;
        source?: 'human' | 'ai' | 'system' | 'automation';
        createdBy?: string;
      };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (!body.contactId) throw createApiError('contactId is required', 400);
      if (!body.type) throw createApiError('type is required', 400);
      if (!body.title) throw createApiError('title is required', 400);

      const event = logEvent({
        organizationId: String(body.organizationId),
        contactId: String(body.contactId),
        type: body.type,
        title: String(body.title),
        description: body.description,
        metadata: body.metadata,
        source: body.source ?? 'human',
        createdBy: body.createdBy,
      });

      res.status(201).json({ event });
    } catch (err) {
      next(err);
    }
  });

  // ---- Contact Timeline ----

  router.get('/timeline/:contactId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contactId } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const typesParam = req.query.types as string | undefined;
      const types = typesParam
        ? typesParam.split(',').map((t) => t.trim()) as TimelineEventType[]
        : undefined;

      const events = getTimeline(String(organizationId), String(contactId), {
        limit,
        offset,
        types,
      });

      res.json({ events, total: events.length });
    } catch (err) {
      next(err);
    }
  });

  // ---- Timeline Summary ----

  router.get('/timeline/:contactId/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contactId } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const summary = await getTimelineSummary(String(organizationId), String(contactId));
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  });

  // ---- Recent Activity ----

  router.get('/timeline/recent', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const limit = req.query.limit ? Number(req.query.limit) : 25;

      const events = getRecentActivity(String(organizationId), limit);
      res.json({ events });
    } catch (err) {
      next(err);
    }
  });

  // ---- Speed to Lead ----

  router.get('/timeline/speed-to-lead', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const contactId = req.query.contactId as string | undefined;
      const days = req.query.days ? Number(req.query.days) : 30;

      if (contactId) {
        const minutes = getSpeedToLead(String(organizationId), String(contactId));
        res.json({ contactId: String(contactId), minutes });
      } else {
        const minutes = getAverageSpeedToLead(String(organizationId), days);
        res.json({ minutes, days, type: 'average' });
      }
    } catch (err) {
      next(err);
    }
  });
}
