/**
 * LeadSpot Agent Service - HTTP Server
 *
 * Express server that exposes the CRM agent API. Called by LeadSpot's
 * FastAPI backend for pipeline briefs, AI suggestions, approval queue
 * management, and cron job scheduling.
 *
 * Entry point: initializes the orchestrator on startup.
 */

import express, { Router, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { createOrchestrator, getOrchestrator } from './orchestrator';
import type {
  AgentServiceConfig,
  AgentBriefRequest,
  CronSchedule,
  CronPayload,
  CRMAction,
} from './types';
import { registerSmartListRoutes } from './routes/smart-lists';
import { registerActionPlanRoutes } from './routes/action-plans';
import { registerLeadRoutingRoutes } from './routes/lead-routing';
import { registerLeadPondRoutes } from './routes/lead-ponds';
import { registerTimelineRoutes } from './routes/timeline';
import { registerVoiceRoutes } from './routes/voice-commands';
import { registerReportingRoutes } from './routes/reporting';
import { resetCronService } from './cron';
import { closeAll } from './db';

// ============================================================================
// Configuration
// ============================================================================

function loadConfig(): AgentServiceConfig {
  return {
    port: Number(process.env.AGENT_SERVICE_PORT) || 3008,
    dataDir: process.env.AGENT_DATA_DIR || './data',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    leadspotApiUrl: process.env.LEADSPOT_API_URL || 'http://localhost:8000',
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles',
  };
}

// ============================================================================
// Error Handler
// ============================================================================

interface ApiError extends Error {
  statusCode?: number;
}

function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  console.error(`[AgentService] Error ${statusCode}: ${message}`);

  res.status(statusCode).json({
    error: message,
    statusCode,
  });
}

/**
 * Create an error with a status code attached.
 */
function createApiError(message: string, statusCode: number): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ============================================================================
// Express App Factory
// ============================================================================

function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  app.get('/api/agent/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'leadspot-agent-service',
      timestamp: new Date().toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // Pipeline Brief
  // --------------------------------------------------------------------------

  app.post('/api/agent/brief', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as AgentBriefRequest;

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      const orchestrator = getOrchestrator();
      const brief = await orchestrator.generateBrief(body.organizationId);

      res.json({ brief });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // Contact Suggestions
  // --------------------------------------------------------------------------

  app.get('/api/agent/suggestions/:contactId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contactId } = req.params;
      const organizationId = req.query.organizationId as string | undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      if (!contactId) {
        throw createApiError('contactId path parameter is required', 400);
      }

      const orchestrator = getOrchestrator();
      const suggestions = await orchestrator.getSuggestions(organizationId, String(contactId));

      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // Approval Queue
  // --------------------------------------------------------------------------

  app.get('/api/agent/queue', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const orchestrator = getOrchestrator();
      let queue = await orchestrator.getQueue(organizationId, status);

      if (limit && limit > 0) {
        queue = queue.slice(0, limit);
      }

      res.json({ queue, total: queue.length });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/agent/queue/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as { organizationId?: string; editedDraft?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      if (!id) {
        throw createApiError('suggestion id path parameter is required', 400);
      }

      // TODO: Pass editedDraft to orchestrator when edit-before-send is implemented
      const orchestrator = getOrchestrator();
      await orchestrator.approveSuggestion(String(body.organizationId), String(id));

      res.json({ success: true, suggestionId: id });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/agent/queue/:id/dismiss', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as { organizationId?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      if (!id) {
        throw createApiError('suggestion id path parameter is required', 400);
      }

      const orchestrator = getOrchestrator();
      await orchestrator.dismissSuggestion(String(body.organizationId), String(id));

      res.json({ success: true, suggestionId: id });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // Cron Jobs
  // --------------------------------------------------------------------------

  app.get('/api/agent/cron', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      // TODO: Wire to CronService from ../cron once available
      // For Phase 1, return empty list
      res.json({ jobs: [], total: 0 });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/agent/cron', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        organizationId?: string;
        name?: string;
        schedule?: CronSchedule;
        payload?: CronPayload;
      };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }

      if (!body.name || !body.schedule || !body.payload) {
        throw createApiError('name, schedule, and payload are required', 400);
      }

      // TODO: Wire to CronService from ../cron once available
      // For Phase 1, acknowledge receipt but don't actually schedule
      const jobId = `cron-${Date.now()}`;

      console.log(`[AgentService] STUB: Would create cron job "${body.name}" for org ${body.organizationId}`);

      res.status(201).json({
        success: true,
        jobId,
        name: body.name,
        schedule: body.schedule,
      });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // Modular Route Modules
  // --------------------------------------------------------------------------

  const agentRouter = Router();
  registerSmartListRoutes(agentRouter);
  registerActionPlanRoutes(agentRouter);
  registerLeadRoutingRoutes(agentRouter);
  registerLeadPondRoutes(agentRouter);
  registerTimelineRoutes(agentRouter);
  registerVoiceRoutes(agentRouter);
  registerReportingRoutes(agentRouter);
  app.use('/api/agent', agentRouter);

  // --------------------------------------------------------------------------
  // Error Handling Middleware (must be registered last)
  // --------------------------------------------------------------------------

  app.use(errorHandler);

  return app;
}

// ============================================================================
// Server Startup
// ============================================================================

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.anthropicApiKey) {
    console.error('[AgentService] ANTHROPIC_API_KEY is required. Set it as an environment variable.');
    process.exit(1);
  }

  // Initialize the orchestrator singleton
  await createOrchestrator(config);

  // Create and start the Express server
  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`[AgentService] LeadSpot Agent Service running on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('[AgentService] Shutting down gracefully...');

    server.close(() => {
      resetCronService();
      closeAll();
      console.log('[AgentService] Server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('[AgentService] Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  console.error('[AgentService] Fatal startup error:', err);
  process.exit(1);
});
