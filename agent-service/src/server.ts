/**
 * LeadSpot Agent Service - HTTP Server
 *
 * Express server that exposes the CRM agent API. Called by LeadSpot's
 * FastAPI backend for pipeline briefs, AI suggestions, approval queue
 * management, and cron job scheduling.
 *
 * Entry point: initializes the orchestrator on startup.
 */

import * as Sentry from '@sentry/node';

// Initialize Sentry error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `leadspot-agent-service@${process.env.npm_package_version || '0.1.0'}`,
    tracesSampleRate: 0.1,
  });
}

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
import { closeAll, getLatestBrief, getSuggestions } from './db';
import { buildContactContext, buildBriefContext, formatContextForPrompt } from './memory/context-builder';

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
  // Voice Agents (stub — returns empty list until voice feature is built)
  // --------------------------------------------------------------------------

  app.get('/api/agent/voice-agents', (_req: Request, res: Response) => {
    res.json({ agents: [], total: 0 });
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
  // Chat Context (consumed by FastAPI chat backend for prompt injection)
  // --------------------------------------------------------------------------

  app.get('/api/agent/context', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string;
      const contactId = req.query.contactId as string | undefined;
      const currentMessage = req.query.message as string | undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      if (contactId) {
        // Contact-level context
        const context = await buildContactContext(organizationId, contactId, currentMessage);
        const formatted = formatContextForPrompt(context);
        res.json({ context: formatted, type: 'contact', contactId });
      } else {
        // Org-level context
        const briefContext = await buildBriefContext(organizationId);
        const latestBrief = getLatestBrief(organizationId);
        const recentSuggestions = getSuggestions(organizationId, { limit: 5 });

        res.json({
          context: briefContext,
          type: 'organization',
          latestBrief: latestBrief ? {
            summary: latestBrief.summary,
            generatedAt: latestBrief.generatedAt,
            newLeads: latestBrief.newLeads,
            followUpsNeeded: latestBrief.followUpsNeeded,
            dealsAtRisk: latestBrief.dealsAtRisk,
          } : null,
          recentSuggestions: recentSuggestions.map(s => ({
            type: s.type,
            title: s.title,
            status: s.status,
            contactId: s.contactId,
          })),
        });
      }
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
  // Health Check (public)
  // --------------------------------------------------------------------------

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'leadspot-agent-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // --------------------------------------------------------------------------
  // Resend Webhook — bounce/complaint suppression (raw body for sig validation)
  // --------------------------------------------------------------------------

  app.post('/api/webhooks/resend', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] RESEND_WEBHOOK_SECRET not set');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    try {
      const { Webhook } = await import('svix');
      const wh = new Webhook(webhookSecret);
      const payload = wh.verify(req.body as Buffer, {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      }) as { type: string; data: { email_id?: string; email_address?: string; bounce?: { type?: string } } };

      const backendUrl = process.env.LEADSPOT_API_URL || 'http://localhost:8000';

      if (payload.type === 'email.bounced') {
        const bounceType = payload.data.bounce?.type ?? 'hard';
        const emailAddress = payload.data.email_address ?? '';
        if (bounceType === 'hard' && emailAddress) {
          await fetch(`${backendUrl}/api/suppressions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailAddress, reason: 'hard_bounce', source: 'resend_webhook' }),
          });
          console.log(`[Webhook] Hard bounce suppressed: ${emailAddress}`);
        }
      } else if (payload.type === 'email.complained') {
        const emailAddress = payload.data.email_address ?? '';
        if (emailAddress) {
          await fetch(`${backendUrl}/api/suppressions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailAddress, reason: 'spam_complaint', source: 'resend_webhook' }),
          });
          console.log(`[Webhook] Spam complaint suppressed: ${emailAddress}`);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] Invalid signature:', error);
      res.status(400).json({ error: 'Invalid webhook signature' });
    }
  });

  // --------------------------------------------------------------------------
  // Unsubscribe — one-click link from email footer
  // --------------------------------------------------------------------------

  app.get('/api/unsubscribe', async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(400).send('<h1>Invalid unsubscribe link</h1>');
      return;
    }

    const { verifyUnsubscribeToken } = await import('./services/email');
    const result = verifyUnsubscribeToken(token);

    if (!result) {
      res.status(400).send('<h1>Invalid or expired unsubscribe link</h1>');
      return;
    }

    const backendUrl = process.env.LEADSPOT_API_URL || 'http://localhost:8000';
    try {
      await fetch(`${backendUrl}/api/suppressions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: result.email, reason: 'unsubscribed', source: 'user_click' }),
      });
      res.send(`
        <html><body style="font-family: sans-serif; max-width: 500px; margin: 100px auto; text-align: center;">
          <h1>You've been unsubscribed</h1>
          <p>You will no longer receive emails from us. This takes effect immediately.</p>
        </body></html>
      `);
    } catch {
      res.status(500).send('<h1>Unsubscribe failed. Please try again.</h1>');
    }
  });

  // --------------------------------------------------------------------------
  // Test Send — send a single email to verify Resend is configured
  // --------------------------------------------------------------------------

  app.post('/api/email/test-send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        to?: string;
        subject?: string;
        body?: string;
        contactId?: string;
        organizationId?: string;
      };

      if (!body.to || !body.subject) {
        throw createApiError('to and subject are required', 400);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.to)) {
        throw createApiError('Invalid email address', 400);
      }

      const { sendEmail } = await import('./services/email');
      const result = await sendEmail({
        to: body.to,
        subject: body.subject,
        body: body.body ?? `<p>This is a test email from LeadSpot. If you received this, email delivery is working correctly.</p>`,
        contactId: body.contactId ?? 'test-send',
        organizationId: body.organizationId ?? 'test',
      });

      if (!result.success) {
        throw createApiError(result.error ?? 'Failed to send test email', 500);
      }

      res.json({ message: `Test email sent to ${body.to}`, messageId: result.messageId });
    } catch (err) {
      next(err);
    }
  });

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
    console.warn('[AgentService] ANTHROPIC_API_KEY not set — AI features disabled');
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
