/**
 * Tests that protected API routes return 401 when no valid session exists.
 *
 * We import the actual route handlers and call them with mock NextRequest
 * objects.  `getServerSession` from next-auth is mocked at the module level
 * so we can control whether a session is present without a real auth stack.
 *
 * Routes under test:
 *   GET  /api/voice/agents
 *   POST /api/voice/agents
 *   GET  /api/billing/wallet
 *   POST /api/billing/wallet
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// -----------------------------------------------------------------------
// Mock next-auth — must be done before importing the route handlers.
// -----------------------------------------------------------------------
const mockGetServerSession = vi.fn();

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// -----------------------------------------------------------------------
// Mock tenant prisma — route handlers call getTenantPrisma after auth check.
// If auth fails (401) this is never reached, but the mock prevents import
// errors from the module trying to connect to a real DB.
// -----------------------------------------------------------------------
vi.mock('@/lib/prisma-tenant', () => ({
  getTenantPrisma: vi.fn(() => ({
    voiceAgent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    wallet: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ balance: 5 }),
      update: vi.fn().mockResolvedValue({}),
    },
    voiceUsage: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 0, totalCost: 0 } }),
    },
  })),
}));

// Mock billing helpers that are called after auth passes (not under test here).
vi.mock('@/lib/billing/balance-check', () => ({
  checkBalanceAndReactivateIfNeeded: vi.fn().mockResolvedValue(undefined),
  checkBalanceAndPauseIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

// Import route handlers AFTER mocks are registered.
import {
  GET as voiceAgentsGET,
  POST as voiceAgentsPOST,
} from '@/app/api/voice/agents/route';

import {
  GET as walletGET,
  POST as walletPOST,
} from '@/app/api/billing/wallet/route';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makePost(url: string, body: object = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

// -----------------------------------------------------------------------
// A valid session stub for the "with session" tests.
// -----------------------------------------------------------------------
const validSession = {
  user: {
    id: 'user-auth-test-01',
    email: 'test@example.com',
    tenantId: 'tenant-auth-test-01',
    tenantSlug: 'test-tenant',
    role: 'user',
  },
  expires: '2099-01-01T00:00:00.000Z',
};

describe('API route auth protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================================================================
  // Voice Agents routes
  // ======================================================================
  describe('GET /api/voice/agents', () => {
    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await voiceAgentsGET(makeGet('http://localhost/api/voice/agents'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user.id', async () => {
      mockGetServerSession.mockResolvedValue({ user: {}, expires: '2099' });

      const response = await voiceAgentsGET(makeGet('http://localhost/api/voice/agents'));

      expect(response.status).toBe(401);
    });

    it('should return 403 when session exists but has no tenantId', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-no-tenant', tenantId: null },
        expires: '2099',
      });

      const response = await voiceAgentsGET(makeGet('http://localhost/api/voice/agents'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toMatch(/no tenant/i);
    });

    it('should return 200 when a valid session is present', async () => {
      mockGetServerSession.mockResolvedValue(validSession);

      const response = await voiceAgentsGET(makeGet('http://localhost/api/voice/agents'));

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/voice/agents', () => {
    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await voiceAgentsPOST(
        makePost('http://localhost/api/voice/agents', { name: 'Agent', type: 'lead_qualification' }),
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 when session exists but has no user.id', async () => {
      mockGetServerSession.mockResolvedValue({ user: { email: 'x@y.com' }, expires: '2099' });

      const response = await voiceAgentsPOST(
        makePost('http://localhost/api/voice/agents', { name: 'Agent', type: 'lead_qualification' }),
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when session exists but has no tenantId', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-no-tenant', tenantId: null },
        expires: '2099',
      });

      const response = await voiceAgentsPOST(
        makePost('http://localhost/api/voice/agents', { name: 'Agent', type: 'lead_qualification' }),
      );

      expect(response.status).toBe(403);
    });

    it('should return 201 when a valid session is present and body is valid', async () => {
      mockGetServerSession.mockResolvedValue(validSession);

      const response = await voiceAgentsPOST(
        makePost('http://localhost/api/voice/agents', {
          name: 'My Agent',
          type: 'lead_qualification',
        }),
      );

      expect(response.status).toBe(201);
    });

    it('should return 400 when session is valid but required fields are missing', async () => {
      mockGetServerSession.mockResolvedValue(validSession);

      const response = await voiceAgentsPOST(
        makePost('http://localhost/api/voice/agents', {}), // no name/type
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/required/i);
    });
  });

  // ======================================================================
  // Billing wallet routes
  // ======================================================================
  describe('GET /api/billing/wallet', () => {
    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await walletGET(makeGet('http://localhost/api/billing/wallet'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user.id', async () => {
      mockGetServerSession.mockResolvedValue({ user: {}, expires: '2099' });

      const response = await walletGET(makeGet('http://localhost/api/billing/wallet'));

      expect(response.status).toBe(401);
    });

    it('should return 403 when session exists but has no tenantId', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-no-tenant', tenantId: null },
        expires: '2099',
      });

      const response = await walletGET(makeGet('http://localhost/api/billing/wallet'));

      expect(response.status).toBe(403);
    });

    it('should return 200 when a valid session is present', async () => {
      mockGetServerSession.mockResolvedValue(validSession);

      const response = await walletGET(makeGet('http://localhost/api/billing/wallet'));

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/billing/wallet', () => {
    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await walletPOST(
        makePost('http://localhost/api/billing/wallet', { amount: 25 }),
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user.id', async () => {
      mockGetServerSession.mockResolvedValue({ user: {}, expires: '2099' });

      const response = await walletPOST(
        makePost('http://localhost/api/billing/wallet', { amount: 25 }),
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when session exists but has no tenantId', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-no-tenant', tenantId: null },
        expires: '2099',
      });

      const response = await walletPOST(
        makePost('http://localhost/api/billing/wallet', { amount: 25 }),
      );

      expect(response.status).toBe(403);
    });

    it('should return 400 when session is valid but amount is missing', async () => {
      mockGetServerSession.mockResolvedValue(validSession);

      const response = await walletPOST(
        makePost('http://localhost/api/billing/wallet', {}), // no amount
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/amount/i);
    });

    it('should return 200 when session is valid and amount is provided', async () => {
      mockGetServerSession.mockResolvedValue(validSession);

      const response = await walletPOST(
        makePost('http://localhost/api/billing/wallet', { amount: 25 }),
      );

      expect(response.status).toBe(200);
    });
  });
});
