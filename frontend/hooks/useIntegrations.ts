/**
 * Hook for managing integrations
 * Handles fetching available integrations, connections, and sync operations
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Integration {
  provider: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  is_configured: boolean;
  demo_available: boolean;
  supports_webhooks: boolean;
  status: string;
}

export interface Connection {
  connection_id: string;
  provider: string;
  status: string;
  connected_user_email?: string;
  connected_user_name?: string;
  last_sync_at?: string;
  last_sync_status?: string;
  documents_synced: number;
  created_at: string;
}

export interface SyncStatus {
  connection_id: string;
  provider: string;
  status: string;
  connected_user?: string;
  last_sync_at?: string;
  last_sync_status?: string;
  documents_synced: number;
  total_documents: number;
}

export interface SyncResult {
  success: boolean;
  documents_synced: number;
  documents_updated: number;
  documents_deleted: number;
  errors: string[];
}

export function useAvailableIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use public endpoint - available integrations aren't user-specific
      const response = await fetch(`${API_BASE}/api/integrations/available/public`);

      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return { integrations, isLoading, error, refetch: fetchIntegrations };
}

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  const fetchConnections = useCallback(async () => {
    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/integrations/connections`, {
        credentials: 'include',
      });

      if (!response.ok) {
        // Don't throw on 401 - just return empty connections
        if (response.status === 401) {
          setConnections([]);
          return;
        }
        throw new Error('Failed to fetch connections');
      }

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to ensure token is hydrated from localStorage
      const timer = setTimeout(() => {
        fetchConnections();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
      setConnections([]);
      return undefined;
    }
  }, [isAuthenticated, fetchConnections]);

  return { connections, isLoading, error, refetch: fetchConnections };
}

export function useSyncStatus() {
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  const fetchStatuses = useCallback(async () => {
    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/integrations/status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setStatuses([]);
          return;
        }
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      setStatuses(data.statuses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        fetchStatuses();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
      setStatuses([]);
      return undefined;
    }
  }, [isAuthenticated, fetchStatuses]);

  return { statuses, isLoading, error, refetch: fetchStatuses };
}

export function useIntegrationActions() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (provider: string, demoMode: boolean = false) => {
    setIsConnecting(true);
    setError(null);

    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    try {
      if (demoMode) {
        // Create demo connection directly
        const response = await fetch(`${API_BASE}/api/integrations/demo/${provider}/connect`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please log in again.');
            throw new Error('Not authenticated');
          }
          throw new Error('Failed to create demo connection');
        }

        const data = await response.json();
        return data;
      } else {
        // Get OAuth URL and redirect
        const response = await fetch(`${API_BASE}/api/integrations/${provider}/authorize`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please log in again.');
            throw new Error('Not authenticated');
          }
          throw new Error('Failed to get authorization URL');
        }

        const data = await response.json();

        // If demo mode URL (no real OAuth), handle inline
        if (data.is_demo_mode) {
          window.location.href = data.authorization_url;
        } else {
          // Redirect to real OAuth
          window.location.href = data.authorization_url;
        }

        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const sync = useCallback(async (
    provider: string,
    connectionId: string,
    fullSync: boolean = false
  ): Promise<SyncResult> => {
    setIsSyncing(true);
    setError(null);

    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    try {
      const response = await fetch(
        `${API_BASE}/api/integrations/${provider}/sync?connection_id=${connectionId}&full_sync=${fullSync}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError('Not authenticated. Please log in again.');
          throw new Error('Not authenticated');
        }
        throw new Error('Failed to sync');
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const disconnect = useCallback(async (provider: string, connectionId: string) => {
    setIsDisconnecting(true);
    setError(null);

    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    try {
      const response = await fetch(
        `${API_BASE}/api/integrations/${provider}/disconnect?connection_id=${connectionId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError('Not authenticated. Please log in again.');
          throw new Error('Not authenticated');
        }
        throw new Error('Failed to disconnect');
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  const syncAll = useCallback(async (fullSync: boolean = false) => {
    setIsSyncing(true);
    setError(null);

    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    try {
      const response = await fetch(
        `${API_BASE}/api/integrations/sync-all?full_sync=${fullSync}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError('Not authenticated. Please log in again.');
          throw new Error('Not authenticated');
        }
        throw new Error('Failed to sync all integrations');
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    connect,
    sync,
    disconnect,
    syncAll,
    isConnecting,
    isSyncing,
    isDisconnecting,
    error,
  };
}
