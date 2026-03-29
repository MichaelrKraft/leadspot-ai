interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const circuits = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 60_000;

export function isCircuitOpen(tenantId: string): boolean {
  const state = circuits.get(tenantId);
  if (!state || state.openedAt === null) return false;

  if (Date.now() - state.openedAt > OPEN_DURATION_MS) {
    // Half-open: reset and allow one attempt
    state.openedAt = null;
    state.failures = 0;
    return false;
  }

  return true;
}

export function recordSuccess(tenantId: string): void {
  circuits.delete(tenantId);
}

export function recordFailure(tenantId: string): void {
  const state = circuits.get(tenantId) ?? { failures: 0, openedAt: null };
  state.failures += 1;

  if (state.failures >= FAILURE_THRESHOLD) {
    state.openedAt = Date.now();
    console.warn(`[CircuitBreaker] Circuit OPEN for tenant ${tenantId} after ${state.failures} failures`);
  }

  circuits.set(tenantId, state);
}

export function getCircuitStatus(tenantId: string): { open: boolean; failures: number } {
  const state = circuits.get(tenantId);
  return {
    open: isCircuitOpen(tenantId),
    failures: state?.failures ?? 0,
  };
}
