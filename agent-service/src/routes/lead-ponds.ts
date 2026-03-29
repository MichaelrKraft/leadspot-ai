/**
 * LeadSpot Agent Service - Lead Ponds Routes
 *
 * Express route handlers for lead pond management: CRUD, entry management,
 * claiming, returning, stats, and default pond creation.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createPond,
  getPonds,
  getPond,
  updatePond,
  deletePond,
  addToPond,
  claimFromPond,
  returnToPond,
  getAvailableEntries,
  getPondStats,
  createDefaultPonds,
} from '../lead-ponds';

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

export function registerLeadPondRoutes(router: Router): void {
  // ---- Pond CRUD ----

  router.get('/ponds', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const ponds = getPonds(String(organizationId));
      res.json({ ponds, total: ponds.length });
    } catch (err) {
      next(err);
    }
  });

  router.post('/ponds', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        name?: string;
        description?: string;
        maxCapacity?: number;
        autoPondRules?: Parameters<typeof createPond>[3];
        allowedAgentIds?: string[];
      };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (!body.name) throw createApiError('name is required', 400);

      const pond = createPond(
        String(body.organizationId),
        String(body.name),
        String(body.description ?? ''),
        Number(body.maxCapacity ?? 0),
        Array.isArray(body.autoPondRules) ? body.autoPondRules : [],
        Array.isArray(body.allowedAgentIds) ? body.allowedAgentIds : [],
      );

      res.status(201).json({ pond });
    } catch (err) {
      next(err);
    }
  });

  router.put('/ponds/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { organizationId, ...updates } = req.body as Record<string, unknown>;
      if (!organizationId) throw createApiError('organizationId is required', 400);

      const success = updatePond(String(organizationId), String(id), updates);
      if (!success) throw createApiError('Pond not found', 404);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/ponds/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const success = deletePond(String(organizationId), String(id));
      if (!success) throw createApiError('Pond not found', 404);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ---- Pond Entries ----

  router.get('/ponds/:id/entries', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const pond = getPond(String(organizationId), String(id));
      if (!pond) throw createApiError('Pond not found', 404);

      const entries = getAvailableEntries(String(organizationId), String(id), limit);
      const stats = getPondStats(String(organizationId), String(id));

      res.json({ entries, total: entries.length, stats });
    } catch (err) {
      next(err);
    }
  });

  router.post('/ponds/:id/add', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as {
        organizationId?: string;
        contactId?: string;
        previousAgentId?: string;
        reason?: string;
      };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (!body.contactId) throw createApiError('contactId is required', 400);

      const entry = addToPond(
        String(body.organizationId),
        String(id),
        String(body.contactId),
        body.reason ?? 'Manually added',
        body.previousAgentId ? String(body.previousAgentId) : null,
      );

      if (!entry) throw createApiError('Unable to add to pond (pond not found or at capacity)', 400);

      res.status(201).json({ entry });
    } catch (err) {
      next(err);
    }
  });

  // ---- Entry Claim / Return ----

  router.post('/ponds/entries/:entryId/claim', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entryId } = req.params;
      const body = req.body as { organizationId?: string; agentId?: string };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (!body.agentId) throw createApiError('agentId is required', 400);

      // claimFromPond needs pondId; look up entry's pond via available entries
      // Since claimFromPond accepts entryId as optional 4th param, we need the pondId.
      // We'll search all ponds for the entry.
      const ponds = getPonds(String(body.organizationId));
      let claimed = null;

      for (const pond of ponds) {
        claimed = claimFromPond(
          String(body.organizationId),
          pond.id,
          String(body.agentId),
          String(entryId),
        );
        if (claimed) break;
      }

      if (!claimed) throw createApiError('Entry not found or not available for claim', 400);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/ponds/entries/:entryId/return', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entryId } = req.params;
      const body = req.body as { organizationId?: string; reason?: string };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);

      const result = returnToPond(
        String(body.organizationId),
        String(entryId),
        body.reason ?? 'Returned by agent',
      );

      if (!result) throw createApiError('Entry not found or not in claimed status', 400);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ---- Pond Stats ----

  router.get('/ponds/:id/stats', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const pond = getPond(String(organizationId), String(id));
      if (!pond) throw createApiError('Pond not found', 404);

      const stats = getPondStats(String(organizationId), String(id));
      res.json({ stats });
    } catch (err) {
      next(err);
    }
  });

  // ---- Default Ponds ----

  router.post('/ponds/defaults', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);

      createDefaultPonds(String(body.organizationId));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });
}
