/**
 * Conversations API client
 * Wraps /api/conversations/* endpoints — uses apiClient (Axios) for auto token refresh
 */

import { apiClient } from '@/lib/api';
import { Conversation, InboxMessage } from '@/types/inbox';

// ── Backend shapes ──────────────────────────────────────────────────────────

interface ApiConversation {
  id: string;
  type: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  subject: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  org_id: string;
  created_at: string;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  direction: string; // "inbound" | "outbound"
  body: string;
  sent_at: string;
  sender_name: string | null;
}

export interface ConversationsListResponse {
  conversations: ApiConversation[];
  page: number;
  limit: number;
}

export interface ConversationDetailResponse {
  conversation: ApiConversation;
  messages: ApiMessage[];
}

export interface CreateConversationData {
  type: 'email' | 'sms';
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  subject?: string;
  first_message?: string;
}

// ── Adapters (API shape → frontend Conversation type) ───────────────────────

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`;
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return `${Math.floor(diffDays)} days ago`;
  return date.toLocaleDateString();
}

function adaptMessage(m: ApiMessage): InboxMessage {
  return {
    id: m.id,
    direction: m.direction === 'outbound' ? 'sent' : 'received',
    content: m.body,
    timestamp: formatRelativeTime(m.sent_at),
  };
}

function adaptConversation(c: ApiConversation, messages: ApiMessage[] = []): Conversation {
  return {
    id: c.id,
    contact: {
      id: 0, // backend conversations don't carry a numeric contact id
      name: c.contact_name,
      company: '',
      email: c.contact_email ?? '',
      points: 0,
    },
    type: (c.type as 'email' | 'sms' | 'chat'),
    lastMessage: c.last_message,
    timestamp: formatRelativeTime(c.last_message_at),
    unread: c.unread_count > 0,
    messages: messages.map(adaptMessage),
  };
}

// ── API functions ────────────────────────────────────────────────────────────

export async function listConversations(params?: {
  type?: string;
  page?: number;
  limit?: number;
}): Promise<Conversation[]> {
  const res = await apiClient.get<ConversationsListResponse>('/api/conversations', { params });
  return res.data.conversations.map((c) => adaptConversation(c));
}

export async function getConversation(id: string): Promise<{ conversation: Conversation }> {
  const res = await apiClient.get<ConversationDetailResponse>(`/api/conversations/${id}`);
  const { conversation, messages } = res.data;
  return { conversation: adaptConversation(conversation, messages) };
}

export async function createConversation(data: CreateConversationData): Promise<Conversation> {
  const res = await apiClient.post<{ conversation: ApiConversation }>('/api/conversations', data);
  return adaptConversation(res.data.conversation);
}

export async function replyToConversation(id: string, body: string): Promise<InboxMessage> {
  const res = await apiClient.post<{ message: ApiMessage }>(`/api/conversations/${id}/reply`, { body });
  return adaptMessage(res.data.message);
}
