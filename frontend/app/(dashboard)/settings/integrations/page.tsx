/**
 * Integrations Settings Page
 * Connect and manage Mautic CRM integration for LeadSpot.ai
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useAvailableIntegrations,
  useConnections,
  useIntegrationActions,
  Integration,
  Connection,
} from '@/hooks/useIntegrations';

// Provider icons and colors
const PROVIDER_CONFIG: Record<string, { icon: React.ReactNode; gradient: string }> = {
  mautic: {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#4e5e9e"/>
        <path d="M2 17l10 5 10-5" stroke="#4e5e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12l10 5 10-5" stroke="#4e5e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    gradient: 'from-indigo-500 to-purple-500',
  },
};

// Integration Card Component
function IntegrationCard({
  integration,
  connection,
  onConnect,
  onDisconnect,
  onSync,
  isConnecting,
  isSyncing,
}: {
  integration: Integration;
  connection?: Connection;
  onConnect: (provider: string, demoMode: boolean) => void;
  onDisconnect: (provider: string, connectionId: string) => void;
  onSync: (provider: string, connectionId: string) => void;
  isConnecting: boolean;
  isSyncing: boolean;
}) {
  const config = PROVIDER_CONFIG[integration.provider] || {
    icon: <div className="w-8 h-8 bg-gray-500 rounded-lg" />,
    gradient: 'from-gray-500 to-gray-600',
  };

  const isConnected = connection?.status === 'active';
  const showDemoOption = !integration.is_configured && integration.demo_available;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 bg-gradient-to-br ${config.gradient} rounded-xl bg-opacity-10`}>
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
            <p className="text-sm text-gray-400">{integration.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />
              Connected
            </span>
          ) : showDemoOption ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              Demo Available
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Connection Info */}
      {isConnected && connection && (
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Connected as</p>
              <p className="text-white font-medium">
                {connection.connected_user_email || connection.connected_user_name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Documents synced</p>
              <p className="text-white font-medium">{connection.documents_synced || 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Last sync</p>
              <p className="text-white font-medium">
                {connection.last_sync_at
                  ? new Date(connection.last_sync_at).toLocaleString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className={`font-medium ${
                connection.last_sync_status === 'success' ? 'text-green-400' :
                connection.last_sync_status?.startsWith('error') ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {connection.last_sync_status || 'Ready'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isConnected && connection ? (
          <>
            <button
              onClick={() => onSync(integration.provider, connection.connection_id)}
              disabled={isSyncing}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
            <button
              onClick={() => onDisconnect(integration.provider, connection.connection_id)}
              className="px-4 py-2 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            {integration.is_configured ? (
              <button
                onClick={() => onConnect(integration.provider, false)}
                disabled={isConnecting}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect
                  </>
                )}
              </button>
            ) : showDemoOption ? (
              <button
                onClick={() => onConnect(integration.provider, true)}
                disabled={isConnecting}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Try Demo
                  </>
                )}
              </button>
            ) : (
              <button
                disabled
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gray-500/10 text-gray-500 border border-gray-500/20 rounded-lg cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Not Configured
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsSettingsPage() {
  const searchParams = useSearchParams();
  const connectedProvider = searchParams.get('connected');

  const { integrations, isLoading: loadingIntegrations } = useAvailableIntegrations();
  const { connections, isLoading: loadingConnections, refetch: refetchConnections } = useConnections();
  const { connect, sync, disconnect, isConnecting, isSyncing } = useIntegrationActions();

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Show success notification if just connected
  useEffect(() => {
    if (connectedProvider) {
      setNotification({
        type: 'success',
        message: `Successfully connected to ${connectedProvider.replace('_', ' ')}!`,
      });
      // Clear URL param
      window.history.replaceState({}, '', '/settings/integrations');
      // Refresh connections
      refetchConnections();
    }
  }, [connectedProvider, refetchConnections]);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleConnect = async (provider: string, demoMode: boolean) => {
    try {
      await connect(provider, demoMode);
      if (demoMode) {
        setNotification({ type: 'success', message: `Demo connection created for ${provider}!` });
        refetchConnections();
      }
    } catch (err) {
      setNotification({ type: 'error', message: `Failed to connect: ${err}` });
    }
  };

  const handleDisconnect = async (provider: string, connectionId: string) => {
    try {
      await disconnect(provider, connectionId);
      setNotification({ type: 'success', message: `Disconnected from ${provider}` });
      refetchConnections();
    } catch (err) {
      setNotification({ type: 'error', message: `Failed to disconnect: ${err}` });
    }
  };

  const handleSync = async (provider: string, connectionId: string) => {
    try {
      const result = await sync(provider, connectionId, false);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `Synced ${result.documents_synced} new, ${result.documents_updated} updated documents`,
        });
      } else {
        setNotification({
          type: 'error',
          message: result.errors.join(', ') || 'Sync failed',
        });
      }
      refetchConnections();
    } catch (err) {
      setNotification({ type: 'error', message: `Sync failed: ${err}` });
    }
  };

  const getConnectionForProvider = (provider: string): Connection | undefined => {
    return connections.find(c => c.provider === provider && c.status === 'active');
  };

  const isLoading = loadingIntegrations || loadingConnections;

  return (
    <div className="p-8">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            notification.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <p className="font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 hover:opacity-75"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Mautic CRM Connection</h1>
        <p className="text-gray-400">
          Connect your Mautic CRM instance to power LeadSpot.ai's AI agents with your contacts and campaigns.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-blue-400 font-medium mb-1">Demo Mode Available</h3>
            <p className="text-sm text-gray-400">
              Don't have Mautic set up yet? Try demo mode with sample contacts and campaigns to explore LeadSpot.ai features.
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-white/10 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-white/10 rounded w-32 mb-2" />
                  <div className="h-4 bg-white/10 rounded w-48" />
                </div>
              </div>
              <div className="h-10 bg-white/10 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Integrations Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.provider}
              integration={integration}
              connection={getConnectionForProvider(integration.provider)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onSync={handleSync}
              isConnecting={isConnecting}
              isSyncing={isSyncing}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && integrations.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No Integrations Available</h3>
          <p className="text-gray-400">
            Integration connectors are being set up. Check back soon.
          </p>
        </div>
      )}

      {/* Coming Soon Section */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-white mb-4">Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'HubSpot', icon: '🔶', description: 'Contacts, deals, tickets' },
            { name: 'Salesforce', icon: '☁️', description: 'Leads, opportunities, accounts' },
            { name: 'Pipedrive', icon: '📊', description: 'Deals, contacts, activities' },
          ].map((item) => (
            <div
              key={item.name}
              className="bg-white/5 border border-white/5 rounded-xl p-4 opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h3 className="text-white font-medium">{item.name}</h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
