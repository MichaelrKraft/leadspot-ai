'use client';

import { useState, useEffect, useCallback } from 'react';

type HealthStatus = 'up' | 'down' | 'starting' | 'unknown';

interface SpaceAgentHealth {
  status: HealthStatus;
  lastChecked: Date | null;
  retry: () => void;
}

export function useSpaceAgentHealth(enabled: boolean = true): SpaceAgentHealth {
  const [status, setStatus] = useState<HealthStatus>('unknown');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/workspace/health', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      setStatus(data.status === 'up' ? 'up' : data.status === 'not_configured' ? 'down' : 'starting');
    } catch {
      setStatus('down');
    }
    setLastChecked(new Date());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    checkHealth();
    const interval = setInterval(checkHealth, 10_000);
    return () => clearInterval(interval);
  }, [enabled, checkHealth]);

  return { status, lastChecked, retry: checkHealth };
}
