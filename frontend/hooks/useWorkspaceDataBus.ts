'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface DataBusOptions {
  organizationId: string | null;
  enabled: boolean;
  intervalMs?: number;
}

interface WorkspaceData {
  contacts: { items: unknown[] } | null;
  deals: { items: unknown[] } | null;
  insights: unknown | null;
  lastFetched: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useWorkspaceDataBus({ organizationId, enabled, intervalMs = 60_000 }: DataBusOptions): WorkspaceData {
  const [data, setData] = useState<WorkspaceData>({
    contacts: null,
    deals: null,
    insights: null,
    lastFetched: null,
    isLoading: false,
    error: null,
  });
  const lastFetchRef = useRef<number>(0);

  const fetchBatch = useCallback(async () => {
    if (!enabled || !organizationId) return;

    const now = Date.now();
    if (now - lastFetchRef.current < intervalMs) return;
    lastFetchRef.current = now;

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/workspace/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify([
          { resource: 'contacts', params: { limit: 25 } },
          { resource: 'deals', params: {} },
        ]),
      });

      if (!res.ok) throw new Error(`Batch fetch failed: ${res.status}`);
      const json = await res.json();

      setData(prev => ({
        ...prev,
        contacts: json.results?.['contacts:[]'] || null,
        deals: json.results?.['deals:[]'] || null,
        lastFetched: new Date(),
        isLoading: false,
      }));
    } catch (err) {
      setData(prev => ({ ...prev, isLoading: false, error: String(err) }));
    }
  }, [enabled, organizationId, intervalMs]);

  useEffect(() => {
    if (!enabled) return;
    fetchBatch();
    const interval = setInterval(fetchBatch, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, fetchBatch, intervalMs]);

  return data;
}
