'use client';

import { useState } from 'react';
import { AgentConfig, HttpTool, McpServer } from './types';
import { HttpToolEditor } from './HttpToolEditor';
import { McpServerEditor } from './McpServerEditor';

interface Props {
  config: AgentConfig;
  onChange: (updates: Partial<AgentConfig>) => void;
}

export function ActionsTab({ config, onChange }: Props) {
  const [editingTool, setEditingTool] = useState<HttpTool | null>(null);
  const [isToolEditorOpen, setIsToolEditorOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [isServerEditorOpen, setIsServerEditorOpen] = useState(false);

  // HTTP Tool handlers
  const handleAddTool = () => {
    setEditingTool(null);
    setIsToolEditorOpen(true);
  };

  const handleEditTool = (tool: HttpTool) => {
    setEditingTool(tool);
    setIsToolEditorOpen(true);
  };

  const handleSaveTool = (tool: HttpTool) => {
    const existingIndex = config.httpTools.findIndex((t) => t.id === tool.id);
    if (existingIndex >= 0) {
      const updated = [...config.httpTools];
      updated[existingIndex] = tool;
      onChange({ httpTools: updated });
    } else {
      onChange({ httpTools: [...config.httpTools, tool] });
    }
  };

  const handleDeleteTool = (toolId: string) => {
    onChange({ httpTools: config.httpTools.filter((t) => t.id !== toolId) });
  };

  // MCP Server handlers
  const handleAddServer = () => {
    setEditingServer(null);
    setIsServerEditorOpen(true);
  };

  const handleEditServer = (server: McpServer) => {
    setEditingServer(server);
    setIsServerEditorOpen(true);
  };

  const handleSaveServer = (server: McpServer) => {
    const existingIndex = config.mcpServers.findIndex((s) => s.id === server.id);
    if (existingIndex >= 0) {
      const updated = [...config.mcpServers];
      updated[existingIndex] = server;
      onChange({ mcpServers: updated });
    } else {
      onChange({ mcpServers: [...config.mcpServers, server] });
    }
  };

  const handleDeleteServer = (serverId: string) => {
    onChange({ mcpServers: config.mcpServers.filter((s) => s.id !== serverId) });
  };

  const methodColors: Record<string, string> = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-8">
      {/* HTTP Tools Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900">HTTP Tools</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Define web requests for your agent to call APIs
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddTool}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-mautic-blue hover:bg-mautic-blue-dark rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add HTTP Tool
          </button>
        </div>

        {config.httpTools.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">No HTTP tools configured</p>
            <p className="text-sm text-gray-500 mt-1">
              Add HTTP tools to let your agent call external APIs
            </p>
            <button
              type="button"
              onClick={handleAddTool}
              className="mt-4 text-sm text-mautic-blue hover:text-mautic-blue-dark font-medium"
            >
              + Add your first HTTP tool
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {config.httpTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition group"
              >
                <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${methodColors[tool.method]}`}>
                      {tool.method}
                    </span>
                    <span className="font-medium text-gray-900">{tool.name}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{tool.url}</p>
                  {tool.parameters.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {tool.parameters.length} parameter{tool.parameters.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => handleEditTool(tool)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTool(tool.id)}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-white rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP Servers Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900">MCP Servers</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect external MCP servers for additional tools
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddServer}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-mautic-blue hover:bg-mautic-blue-dark rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add MCP Server
          </button>
        </div>

        {config.mcpServers.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">No MCP servers configured</p>
            <p className="text-sm text-gray-500 mt-1">
              Connect MCP servers to extend your agent's capabilities
            </p>
            <button
              type="button"
              onClick={handleAddServer}
              className="mt-4 text-sm text-mautic-blue hover:text-mautic-blue-dark font-medium"
            >
              + Add your first MCP server
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {config.mcpServers.map((server) => (
              <div
                key={server.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition group"
              >
                <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{server.name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      server.authType === 'none'
                        ? 'bg-gray-100 text-gray-600'
                        : server.authType === 'api_key'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {server.authType === 'none' ? 'No Auth' : server.authType === 'api_key' ? 'API Key' : 'OAuth'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate font-mono">{server.url}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => handleEditServer(server)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteServer(server.id)}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-white rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <HttpToolEditor
        tool={editingTool}
        isOpen={isToolEditorOpen}
        onClose={() => setIsToolEditorOpen(false)}
        onSave={handleSaveTool}
      />

      <McpServerEditor
        server={editingServer}
        isOpen={isServerEditorOpen}
        onClose={() => setIsServerEditorOpen(false)}
        onSave={handleSaveServer}
      />
    </div>
  );
}
