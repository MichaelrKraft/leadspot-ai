'use client';

import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface GmailConnection {
  connection_id: string;
  connected_user_email: string;
  connected_user_name?: string;
  status: 'active' | 'expired' | 'revoked' | 'error';
  documents_synced: number;
  last_sync_at?: string;
  created_at: string;
}

interface GmailIntegrationCardProps {
  connection?: GmailConnection;
  onConnect: () => void;
  onDisconnect: (connectionId: string) => void;
  onSync: (connectionId: string) => void;
  isLoading?: boolean;
}

export default function GmailIntegrationCard({
  connection,
  onConnect,
  onDisconnect,
  onSync,
  isLoading = false,
}: GmailIntegrationCardProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!connection) return;
    setSyncing(true);
    try {
      await onSync(connection.connection_id);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: GmailConnection['status']) => {
    const styles = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      expired: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      revoked: 'bg-red-500/20 text-red-400 border-red-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <Card variant="default" hover>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Gmail Icon */}
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12zm0-14H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <div>
              <CardTitle>Gmail</CardTitle>
              <CardDescription>Search your email history with AI</CardDescription>
            </div>
          </div>
          {connection && getStatusBadge(connection.status)}
        </div>
      </CardHeader>

      <CardContent>
        {connection ? (
          <div className="space-y-4">
            {/* Connected Account Info */}
            <div className="p-4 rounded-lg bg-background-tertiary border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {connection.connected_user_name?.charAt(0) || connection.connected_user_email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {connection.connected_user_name || 'Gmail Account'}
                  </p>
                  <p className="text-sm text-gray-400">{connection.connected_user_email}</p>
                </div>
              </div>
            </div>

            {/* Sync Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-background-tertiary border border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Emails Indexed</p>
                <p className="text-2xl font-semibold text-white mt-1">
                  {connection.documents_synced.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary border border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Last Sync</p>
                <p className="text-sm font-medium text-white mt-1">
                  {formatDate(connection.last_sync_at)}
                </p>
              </div>
            </div>

            {/* Example Queries */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400 font-medium mb-2">Try asking:</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>"What company sent me a cruise offer last month?"</li>
                <li>"Find emails from my accountant about taxes"</li>
                <li>"What did John say about the project deadline?"</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12zm0-14H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <p className="text-gray-400 mb-2">Connect your Gmail account to search emails with AI</p>
            <p className="text-sm text-gray-500">
              InnoSynth will only read emails (read-only access)
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        {connection ? (
          <div className="flex gap-3">
            <Button
              onClick={handleSync}
              disabled={syncing || isLoading || connection.status !== 'active'}
              variant="primary"
              className="flex-1"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                'Sync Now'
              )}
            </Button>
            <Button
              onClick={() => onDisconnect(connection.connection_id)}
              disabled={isLoading}
              variant="secondary"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={onConnect}
            disabled={isLoading}
            variant="primary"
            className="w-full"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Connect Gmail
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
