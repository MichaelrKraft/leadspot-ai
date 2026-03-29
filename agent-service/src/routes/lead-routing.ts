/**
 * LeadSpot Agent Service - Lead Routing Routes
 *
 * Express route handlers for the lead routing engine: config, assignments,
 * agents, rules, and first-to-claim workflows.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  getRoutingConfig,
  updateRoutingConfig,
  routeLead,
  getAssignmentsForAgent,
  getAssignmentsForContact,
  getRoutingHistory,
  claimLead,
  getUnclaimedLeads,
  addTeamAgent,
  getTeamAgents,
  updateTeamAgent,
  removeTeamAgent,
  setAgentOnlineStatus,
  createRoutingRule,
  getRoutingRules,
  updateRoutingRule,
  deleteRoutingRule,
  handleAgentDeparture,
} from '../lead-routing';

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

export function registerLeadRoutingRoutes(router: Router): void {
  // ---- Config ----

  router.get('/routing/config', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const config = getRoutingConfig(String(organizationId));
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  router.put('/routing/config', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, ...updates } = req.body as Record<string, unknown>;
      if (!organizationId) throw createApiError('organizationId is required', 400);

      const config = updateRoutingConfig(String(organizationId), updates);
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  // ---- Core Routing ----

  router.post('/routing/route', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        contactId?: string;
        metadata?: Record<string, string>;
      };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (!body.contactId) throw createApiError('contactId is required', 400);

      const assignment = routeLead(
        String(body.organizationId),
        String(body.contactId),
        body.metadata ?? {},
      );
      res.json({ assignment });
    } catch (err) {
      next(err);
    }
  });

  // ---- Assignments ----

  router.get('/routing/assignments', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const agentId = req.query.agentId as string | undefined;
      const contactId = req.query.contactId as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      let assignments;
      if (agentId) {
        assignments = getAssignmentsForAgent(String(organizationId), String(agentId));
      } else if (contactId) {
        assignments = getAssignmentsForContact(String(organizationId), String(contactId));
      } else {
        assignments = getRoutingHistory(String(organizationId), limit ?? 100);
      }

      const statusFilter = req.query.status as string | undefined;
      if (statusFilter) {
        assignments = assignments.filter((a) => a.status === statusFilter);
      }

      if (limit && limit > 0) {
        assignments = assignments.slice(0, limit);
      }

      res.json({ assignments, total: assignments.length });
    } catch (err) {
      next(err);
    }
  });

  router.post('/routing/claim/:assignmentId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assignmentId } = req.params;
      const body = req.body as { organizationId?: string; agentId?: string };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (!body.agentId) throw createApiError('agentId is required', 400);

      const result = claimLead(String(body.organizationId), String(assignmentId), String(body.agentId));
      if (!result) throw createApiError('Unable to claim assignment', 400);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/routing/unclaimed', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const assignments = getUnclaimedLeads(String(organizationId));
      res.json({ assignments, total: assignments.length });
    } catch (err) {
      next(err);
    }
  });

  router.get('/routing/history', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const limit = req.query.limit ? Number(req.query.limit) : 50;
      let history = getRoutingHistory(String(organizationId), limit);

      const agentId = req.query.agentId as string | undefined;
      if (agentId) {
        history = history.filter((a) => a.assignedAgentId === String(agentId));
      }

      res.json({ history, total: history.length });
    } catch (err) {
      next(err);
    }
  });

  // ---- Agents ----

  router.get('/routing/agents', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      let agents = getTeamAgents(String(organizationId));

      const activeOnly = req.query.activeOnly as string | undefined;
      if (activeOnly === 'true') {
        agents = agents.filter((a) => a.isActive);
      }

      res.json({ agents, total: agents.length });
    } catch (err) {
      next(err);
    }
  });

  router.post('/routing/agents', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, userId, name, email, ...rest } = req.body as Record<string, unknown>;
      if (!organizationId) throw createApiError('organizationId is required', 400);
      if (!userId) throw createApiError('userId is required', 400);
      if (!name) throw createApiError('name is required', 400);
      if (!email) throw createApiError('email is required', 400);

      const agent = addTeamAgent(String(organizationId), {
        userId: String(userId),
        name: String(name),
        email: String(email),
        ...rest,
      } as Parameters<typeof addTeamAgent>[1]);

      res.status(201).json({ agent });
    } catch (err) {
      next(err);
    }
  });

  router.put('/routing/agents/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { organizationId, ...updates } = req.body as Record<string, unknown>;
      if (!organizationId) throw createApiError('organizationId is required', 400);

      const result = updateTeamAgent(String(organizationId), String(id), updates);
      if (!result) throw createApiError('Agent not found', 404);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/routing/agents/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const reassignStrategy = (req.query.reassignStrategy as string) || 'round_robin';
      const validStrategies = ['round_robin', 'pond'] as const;
      const strategy = validStrategies.includes(reassignStrategy as typeof validStrategies[number])
        ? (reassignStrategy as 'round_robin' | 'pond')
        : 'round_robin';

      const reassigned = handleAgentDeparture(String(organizationId), String(id), strategy);
      const removed = removeTeamAgent(String(organizationId), String(id));

      if (!removed && reassigned.length === 0) {
        throw createApiError('Agent not found', 404);
      }

      res.json({ success: true, reassigned: reassigned.length });
    } catch (err) {
      next(err);
    }
  });

  router.put('/routing/agents/:id/status', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as { organizationId?: string; isOnline?: boolean };
      if (!body.organizationId) throw createApiError('organizationId is required', 400);
      if (body.isOnline === undefined) throw createApiError('isOnline is required', 400);

      const success = setAgentOnlineStatus(String(body.organizationId), String(id), body.isOnline);
      if (!success) throw createApiError('Agent not found', 404);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ---- Rules ----

  router.get('/routing/rules', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const rules = getRoutingRules(String(organizationId));
      res.json({ rules });
    } catch (err) {
      next(err);
    }
  });

  router.post('/routing/rules', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, name, priority, conditions, ...rest } = req.body as Record<string, unknown>;
      if (!organizationId) throw createApiError('organizationId is required', 400);
      if (!name) throw createApiError('name is required', 400);
      if (!conditions) throw createApiError('conditions is required', 400);

      const rule = createRoutingRule(String(organizationId), {
        name: String(name),
        conditions: conditions as Parameters<typeof createRoutingRule>[1]['conditions'],
        priority: priority !== undefined ? Number(priority) : undefined,
        ...rest,
      } as Parameters<typeof createRoutingRule>[1]);

      res.status(201).json({ rule });
    } catch (err) {
      next(err);
    }
  });

  router.put('/routing/rules/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { organizationId, ...updates } = req.body as Record<string, unknown>;
      if (!organizationId) throw createApiError('organizationId is required', 400);

      const success = updateRoutingRule(String(organizationId), String(id), updates);
      if (!success) throw createApiError('Rule not found', 404);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/routing/rules/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) throw createApiError('organizationId query parameter is required', 400);

      const success = deleteRoutingRule(String(organizationId), String(id));
      if (!success) throw createApiError('Rule not found', 404);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });
}
