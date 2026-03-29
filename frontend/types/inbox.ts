export type ConversationType = 'email' | 'sms' | 'chat';
export type MessageDirection = 'sent' | 'received';
export type FilterType = 'all' | ConversationType;

export interface InboxContact {
  id: number;
  name: string;
  company: string;
  email: string;
  points: number;
  tags?: string[];
}

export interface InboxMessage {
  id: string;
  direction: MessageDirection;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  contact: InboxContact;
  type: ConversationType;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  messages: InboxMessage[];
}
