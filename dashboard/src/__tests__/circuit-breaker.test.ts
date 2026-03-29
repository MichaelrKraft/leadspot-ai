/**
 * Tests for mautic-circuit-breaker.ts.
 *
 * The circuit breaker is a pure in-memory state machine with no external
 * dependencies, so no mocks are needed.  We do mock Date.now() to control
 * the passage of time for the half-open transition.
 *
 * Important: the `circuits` Map is module-level state that persists across
 * test cases within a single test run.  We use a unique tenantId per test
 * (or call recordSuccess to reset) so tests remain independent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  getCircuitStatus,
} from '@/lib/mautic-circuit-breaker';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 60_000;

/** Generate a unique tenant id to keep tests isolated from each other. */
let counter = 0;
function uniqueTenant(): string {
  return `tenant-cb-${Date.now()}-${++counter}`;
}

/** Drive a circuit to the open state by recording FAILURE_THRESHOLD failures. */
function openCircuit(tenantId: string): void {
  for (let i = 0; i < FAILURE_THRESHOLD; i++) {
    recordFailure(tenantId);
  }
}

describe('mautic-circuit-breaker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('should start closed for a brand-new tenantId', () => {
      const tenantId = uniqueTenant();
      expect(isCircuitOpen(tenantId)).toBe(false);
    });

    it('should report 0 failures for a brand-new tenantId', () => {
      const tenantId = uniqueTenant();
      const status = getCircuitStatus(tenantId);
      expect(status.failures).toBe(0);
      expect(status.open).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Failure accumulation
  // -----------------------------------------------------------------------
  describe('failure accumulation', () => {
    it('should remain closed after fewer than FAILURE_THRESHOLD failures', () => {
      const tenantId = uniqueTenant();

      for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
        recordFailure(tenantId);
      }

      expect(isCircuitOpen(tenantId)).toBe(false);
    });

    it('should track failure count before the threshold', () => {
      const tenantId = uniqueTenant();

      recordFailure(tenantId);
      recordFailure(tenantId);

      expect(getCircuitStatus(tenantId).failures).toBe(2);
    });

    it('should open after exactly FAILURE_THRESHOLD failures', () => {
      const tenantId = uniqueTenant();

      openCircuit(tenantId);

      expect(isCircuitOpen(tenantId)).toBe(true);
    });

    it('should remain open after more than FAILURE_THRESHOLD failures', () => {
      const tenantId = uniqueTenant();

      openCircuit(tenantId);
      recordFailure(tenantId); // 4th failure — circuit already open

      expect(isCircuitOpen(tenantId)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // isCircuitOpen returns true when open
  // -----------------------------------------------------------------------
  describe('isCircuitOpen', () => {
    it('should return true immediately after circuit opens', () => {
      const tenantId = uniqueTenant();
      openCircuit(tenantId);
      expect(isCircuitOpen(tenantId)).toBe(true);
    });

    it('should return false for an unknown tenant', () => {
      expect(isCircuitOpen('completely-unknown-tenant')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Half-open transition after OPEN_DURATION_MS
  // -----------------------------------------------------------------------
  describe('half-open transition', () => {
    it('should transition to half-open (allow one attempt) after OPEN_DURATION_MS', () => {
      const tenantId = uniqueTenant();
      openCircuit(tenantId);

      // Freeze time just past the open window.
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + OPEN_DURATION_MS + 1);

      // isCircuitOpen should return false (half-open) and reset state.
      expect(isCircuitOpen(tenantId)).toBe(false);
    });

    it('should still be open just before OPEN_DURATION_MS elapses', () => {
      const tenantId = uniqueTenant();
      const openTime = Date.now();

      vi.spyOn(Date, 'now').mockReturnValueOnce(openTime); // used when recordFailure sets openedAt
      openCircuit(tenantId);

      // Advance time to just before the window expires.
      vi.spyOn(Date, 'now').mockReturnValue(openTime + OPEN_DURATION_MS - 1);

      expect(isCircuitOpen(tenantId)).toBe(true);
    });

    it('should reset failure count when transitioning to half-open', () => {
      const tenantId = uniqueTenant();
      openCircuit(tenantId);

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + OPEN_DURATION_MS + 1);

      // Trigger half-open transition.
      isCircuitOpen(tenantId);

      const status = getCircuitStatus(tenantId);
      expect(status.failures).toBe(0);
      expect(status.open).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // recordSuccess
  // -----------------------------------------------------------------------
  describe('recordSuccess', () => {
    it('should reset the circuit completely', () => {
      const tenantId = uniqueTenant();
      openCircuit(tenantId);

      expect(isCircuitOpen(tenantId)).toBe(true);

      recordSuccess(tenantId);

      expect(isCircuitOpen(tenantId)).toBe(false);
      expect(getCircuitStatus(tenantId).failures).toBe(0);
    });

    it('should be a no-op for a circuit that was never opened', () => {
      const tenantId = uniqueTenant();

      expect(() => recordSuccess(tenantId)).not.toThrow();
      expect(isCircuitOpen(tenantId)).toBe(false);
    });

    it('should allow the circuit to open again after reset if failures recur', () => {
      const tenantId = uniqueTenant();
      openCircuit(tenantId);
      recordSuccess(tenantId);

      // Circuit is now closed — accumulate failures again.
      openCircuit(tenantId);

      expect(isCircuitOpen(tenantId)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getCircuitStatus
  // -----------------------------------------------------------------------
  describe('getCircuitStatus', () => {
    it('should return open:true and non-zero failures when circuit is open', () => {
      const tenantId = uniqueTenant();
      openCircuit(tenantId);

      const status = getCircuitStatus(tenantId);

      expect(status.open).toBe(true);
      expect(status.failures).toBeGreaterThanOrEqual(FAILURE_THRESHOLD);
    });

    it('should return open:false and correct failure count when closed', () => {
      const tenantId = uniqueTenant();
      recordFailure(tenantId);
      recordFailure(tenantId);

      const status = getCircuitStatus(tenantId);

      expect(status.open).toBe(false);
      expect(status.failures).toBe(2);
    });

    it('should return 0 failures for unknown tenant', () => {
      const status = getCircuitStatus('never-seen-before');
      expect(status.failures).toBe(0);
      expect(status.open).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Tenant isolation
  // -----------------------------------------------------------------------
  describe('tenant isolation', () => {
    it('should not let failures from one tenant affect another', () => {
      const tenantA = uniqueTenant();
      const tenantB = uniqueTenant();

      openCircuit(tenantA);

      expect(isCircuitOpen(tenantA)).toBe(true);
      expect(isCircuitOpen(tenantB)).toBe(false);
    });

    it('should track failure counts independently per tenant', () => {
      const tenantA = uniqueTenant();
      const tenantB = uniqueTenant();

      recordFailure(tenantA);
      recordFailure(tenantA);
      recordFailure(tenantB);

      expect(getCircuitStatus(tenantA).failures).toBe(2);
      expect(getCircuitStatus(tenantB).failures).toBe(1);
    });
  });
});
