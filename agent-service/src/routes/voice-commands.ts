/**
 * LeadSpot Agent Service - Voice Command Routes
 *
 * Express routes for parsing, executing, and retrieving voice commands.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  parseVoiceCommand,
  executeVoiceCommand,
  getCommandHistory,
  type ParsedVoiceCommand,
} from '../voice-commands';

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

// ============================================================================
// Route Registration
// ============================================================================

export function registerVoiceRoutes(router: Router): void {
  // --------------------------------------------------------------------------
  // POST /voice/parse
  // --------------------------------------------------------------------------

  router.post('/voice/parse', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string; text?: string };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }
      if (!body.text) {
        throw createApiError('text is required', 400);
      }

      const command = await parseVoiceCommand(
        String(body.text),
        String(body.organizationId),
      );

      res.json({ command });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // POST /voice/execute
  // --------------------------------------------------------------------------

  router.post('/voice/execute', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { organizationId?: string; command?: ParsedVoiceCommand };

      if (!body.organizationId) {
        throw createApiError('organizationId is required', 400);
      }
      if (!body.command) {
        throw createApiError('command is required', 400);
      }

      const result = await executeVoiceCommand(
        body.command,
        String(body.organizationId),
      );

      res.json({ result });
    } catch (err) {
      next(err);
    }
  });

  // --------------------------------------------------------------------------
  // GET /voice/history
  // --------------------------------------------------------------------------

  router.get('/voice/history', (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      const limitParam = req.query.limit as string | undefined;

      if (!organizationId) {
        throw createApiError('organizationId query parameter is required', 400);
      }

      const limit = limitParam ? Number(String(limitParam)) : 20;
      const commands = getCommandHistory(String(organizationId), limit);

      res.json({ commands, total: commands.length });
    } catch (err) {
      next(err);
    }
  });
}
