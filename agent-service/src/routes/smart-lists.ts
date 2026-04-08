/**
 * LeadSpot Agent Service - Smart List Routes
 *
 * Express routes for smart list CRUD, evaluation, and tracking.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createSmartList,
  getSmartLists,
  getSmartList,
  updateSmartList,
  deleteSmartList,
  evaluateSmartList,
  markContactActedUpon,
  createDefaultSmartLists,
} from '../smart-lists';
import type { SmartListRule, SmartList } from '../smart-lists';

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

export function registerSmartListRoutes(router: Router): void {
  // GET /smart-lists — list all smart lists for an organization
  router.get('/smart-lists', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      let lists = getSmartLists(organizationId);

      if (lists.length === 0) {
        createDefaultSmartLists(organizationId);
        lists = getSmartLists(organizationId);
      }

      res.json({ lists, total: lists.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /smart-lists/:id — get a single smart list
  router.get('/smart-lists/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const list = getSmartList(organizationId, String(req.params.id));
      if (!list) {
        throw createApiError('Smart list not found', 404);
      }

      res.json({ list });
    } catch (err) {
      next(err);
    }
  });

  // POST /smart-lists — create a new smart list
  router.post('/smart-lists', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        name?: string;
        rules?: SmartListRule[];
        sortBy?: SmartList['sortBy'];
        description?: string;
      };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }
      if (!body.name) {
        throw createApiError('name is required', 400);
      }
      if (!body.rules || !Array.isArray(body.rules)) {
        throw createApiError('rules array is required', 400);
      }

      const list = createSmartList(
        body.organizationId,
        body.name,
        body.rules,
        body.sortBy,
        body.description,
      );

      res.status(201).json({ list });
    } catch (err) {
      next(err);
    }
  });

  // PUT /smart-lists/:id — update an existing smart list
  router.put('/smart-lists/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        name?: string;
        description?: string;
        rules?: SmartListRule[];
        sortBy?: SmartList['sortBy'];
        sortOrder?: SmartList['sortOrder'];
      };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const { organizationId, ...updates } = body;
      const success = updateSmartList(organizationId, String(req.params.id), updates);

      if (!success) {
        throw createApiError('Smart list not found', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /smart-lists/:id — delete a smart list
  router.delete('/smart-lists/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId
        ? String(req.query.organizationId)
        : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const success = deleteSmartList(organizationId, String(req.params.id));
      if (!success) {
        throw createApiError('Smart list not found', 404);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /smart-lists/:id/evaluate — evaluate a smart list against contacts
  router.post('/smart-lists/:id/evaluate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const result = await evaluateSmartList(body.organizationId, String(req.params.id));
      if (!result) {
        throw createApiError('Smart list not found', 404);
      }

      res.json({ result });
    } catch (err) {
      next(err);
    }
  });

  // POST /smart-lists/:id/mark-acted — mark a contact as acted upon
  router.post('/smart-lists/:id/mark-acted', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string; contactId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }
      if (!body.contactId) {
        throw createApiError('contactId is required', 400);
      }

      markContactActedUpon(body.organizationId, String(req.params.id), body.contactId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /smart-lists/defaults — create default smart lists for an organization
  router.post('/smart-lists/defaults', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      createDefaultSmartLists(body.organizationId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });
}
