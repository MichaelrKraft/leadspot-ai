/**
 * Chat API service
 * Uses axios instance for auth headers + CSRF token
 */

import { apiClient } from '@/lib/api';

export interface ChatToolResult {
  tool: string;
  input: Record<string, unknown>;
  success: boolean;
  display: string;
}

export interface ChatResponse {
  response: string;
  message?: string;
  status: string;
  tools_used: string[];
  tool_results?: ChatToolResult[];
  timestamp: string;
}

export async function sendChatMessage(
  message: string,
  enableTools = true
): Promise<ChatResponse> {
  const { data } = await apiClient.post('/api/chat', {
    message,
    enable_tools: enableTools,
  });
  return data;
}

export async function getChatStatus(): Promise<{
  status: string;
  model: string;
  tools_available: number;
}> {
  const res = await fetch('/api/chat/status');
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
