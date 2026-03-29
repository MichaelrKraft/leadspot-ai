'use client';

import { useState, useEffect } from 'react';
import { McpServer } from './types';

interface Props {
  server: McpServer | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (server: McpServer) => void;
}

const DEFAULT_SERVER: McpServer = {
  id: '',
  name: '',
  url: '',
  authType: 'none',
  authConfig: {},
};

export function McpServerEditor({ server, isOpen, onClose, onSave }: Props) {
  const [formData, setFormData] = useState<McpServer>(DEFAULT_SERVER);

  useEffect(() => {
    if (server) {
      setFormData(server);
    } else {
      setFormData({ ...DEFAULT_SERVER, id: `mcp_${Date.now()}` });
    }
  }, [server, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const updateAuthConfig = (key: string, value: string) => {
    setFormData({
      ...formData,
      authConfig: { ...formData.authConfig, [key]: value },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              {server ? 'Edit MCP Server' : 'Add MCP Server'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">MCP Server Integration</p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    Connect your agent to external MCP (Model Context Protocol) servers to give it access to additional tools and capabilities.
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My MCP Server"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm"
              />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server URL *
              </label>
              <p className="text-xs text-gray-500 mb-2">
                SSE endpoint or stdio command for the MCP server
              </p>
              <input
                type="text"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://mcp-server.example.com/sse"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm font-mono"
              />
            </div>

            {/* Authentication Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Authentication
              </label>
              <div className="space-y-2">
                {(['none', 'api_key', 'oauth'] as const).map((authType) => (
                  <label
                    key={authType}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                      formData.authType === authType
                        ? 'border-mautic-blue bg-mautic-blue/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="authType"
                      value={authType}
                      checked={formData.authType === authType}
                      onChange={() => setFormData({ ...formData, authType, authConfig: {} })}
                      className="sr-only"
                    />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {authType === 'none' && 'No Authentication'}
                        {authType === 'api_key' && 'API Key'}
                        {authType === 'oauth' && 'OAuth 2.0'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {authType === 'none' && 'Server requires no authentication'}
                        {authType === 'api_key' && 'Authenticate using an API key header'}
                        {authType === 'oauth' && 'Authenticate using OAuth 2.0 credentials'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Auth Config - API Key */}
            {formData.authType === 'api_key' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Header Name
                  </label>
                  <input
                    type="text"
                    value={formData.authConfig.headerName || ''}
                    onChange={(e) => updateAuthConfig('headerName', e.target.value)}
                    placeholder="X-API-Key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.authConfig.apiKey || ''}
                    onChange={(e) => updateAuthConfig('apiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            )}

            {/* Auth Config - OAuth */}
            {formData.authType === 'oauth' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={formData.authConfig.clientId || ''}
                    onChange={(e) => updateAuthConfig('clientId', e.target.value)}
                    placeholder="client_id"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={formData.authConfig.clientSecret || ''}
                    onChange={(e) => updateAuthConfig('clientSecret', e.target.value)}
                    placeholder="client_secret"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token URL
                  </label>
                  <input
                    type="url"
                    value={formData.authConfig.tokenUrl || ''}
                    onChange={(e) => updateAuthConfig('tokenUrl', e.target.value)}
                    placeholder="https://auth.example.com/oauth/token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!formData.name || !formData.url}
              className="px-4 py-2 text-sm font-medium text-white bg-mautic-blue hover:bg-mautic-blue-dark rounded-lg transition disabled:opacity-50"
            >
              {server ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
