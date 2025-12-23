/**
 * Sources/Integrations Hook
 * Manages OAuth connections for external data sources (Google Drive, OneDrive, Slack)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface OAuthConnection {
  connection_id: string;
  provider: string;
  connected_user_email: string | null;
  connected_user_name: string | null;
  status: 'active' | 'expired' | 'revoked' | 'error';
  scopes: string[];
  expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  documents_synced: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
}

// Available OAuth providers
export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google Drive',
    description: 'Connect your Google Drive to sync documents',
    icon: '📁',
    available: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Connect Salesforce CRM to sync accounts, contacts, and opportunities',
    icon: '☁️',
    available: true,
  },
  {
    id: 'microsoft',
    name: 'Microsoft OneDrive',
    description: 'Connect your OneDrive to sync documents',
    icon: '📂',
    available: false, // Disabled - no OneDrive account configured
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack to sync messages and files',
    icon: '💬',
    available: false, // Disabled - no Slack workspace configured
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect Notion to sync pages and databases',
    icon: '📝',
    available: false, // Not yet implemented
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Connect Confluence to sync wiki pages',
    icon: '🌐',
    available: false, // Not yet implemented
  },
];

// Fetch all connections
export function useConnections(provider?: string) {
  return useQuery({
    queryKey: ['oauth', 'connections', provider],
    queryFn: async (): Promise<OAuthConnection[]> => {
      const params = new URLSearchParams();
      if (provider) {
        params.append('provider', provider);
      }

      const response = await fetch(
        `${API_URL}/api/oauth/connections?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }

      const data = await response.json();
      return data.connections || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Get authorization URL for a provider
export function useAuthorize() {
  return useMutation({
    mutationFn: async (provider: string): Promise<{ authorization_url: string; state: string }> => {
      const response = await fetch(
        `${API_URL}/api/oauth/${provider}/authorize`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to OAuth provider
      window.location.href = data.authorization_url;
    },
  });
}

// Disconnect a provider
export function useDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      connectionId,
    }: {
      provider: string;
      connectionId: string;
    }) => {
      const response = await fetch(
        `${API_URL}/api/oauth/${provider}/disconnect?connection_id=${connectionId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth', 'connections'] });
    },
  });
}

// Refresh token for a connection
export function useRefreshToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      connectionId,
    }: {
      provider: string;
      connectionId: string;
    }) => {
      const response = await fetch(
        `${API_URL}/api/oauth/${provider}/refresh?connection_id=${connectionId}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth', 'connections'] });
    },
  });
}

// Get connection status summary
export function useConnectionsSummary() {
  const { data: connections, isLoading, error } = useConnections();

  const summary = {
    total: connections?.length || 0,
    active: connections?.filter(c => c.status === 'active').length || 0,
    documents: connections?.reduce((sum, c) => sum + c.documents_synced, 0) || 0,
    needsAttention: connections?.filter(c => c.status === 'expired' || c.status === 'error').length || 0,
  };

  return { summary, isLoading, error };
}
