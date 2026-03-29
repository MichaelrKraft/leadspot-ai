'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ConversationList from '@/components/inbox/ConversationList';
import MessageThread from '@/components/inbox/MessageThread';
import ContactSidebar from '@/components/inbox/ContactSidebar';
import { Conversation, FilterType } from '@/types/inbox';

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    contact: {
      id: 1,
      name: 'Sarah Johnson',
      company: 'Acme Corp',
      email: 'sarah@acme.com',
      points: 2450,
      tags: ['VIP', 'Enterprise'],
    },
    type: 'email',
    lastMessage: 'Thanks for the proposal! Let me review with my team.',
    timestamp: '2 hours ago',
    unread: true,
    messages: [
      {
        id: 'm1',
        direction: 'sent',
        content:
          "Hi Sarah,\n\nFollowing up on our conversation about the Enterprise plan. I've attached the updated proposal with the custom pricing we discussed.\n\nLet me know if you have any questions!",
        timestamp: 'Yesterday 2:30 PM',
      },
      {
        id: 'm2',
        direction: 'received',
        content:
          'Thanks for the proposal! Let me review with my team. We should have a decision by end of week.',
        timestamp: 'Today 10:15 AM',
      },
    ],
  },
  {
    id: 'conv-2',
    contact: {
      id: 2,
      name: 'Mike Chen',
      company: 'TechStart',
      email: 'mike@techstart.io',
      points: 1820,
      tags: ['Startup'],
    },
    type: 'chat',
    lastMessage: 'Here are your top 10 contacts sorted by engagement...',
    timestamp: '5 hours ago',
    unread: false,
    messages: [
      {
        id: 'm3',
        direction: 'sent',
        content: 'Show me my top contacts',
        timestamp: 'Today 3:00 PM',
      },
      {
        id: 'm4',
        direction: 'received',
        content:
          'Here are your top 10 contacts sorted by engagement score:\n\n1. Sarah Johnson - 2,450 pts\n2. Mike Chen - 1,820 pts\n3. Lisa Park - 1,540 pts',
        timestamp: 'Today 3:00 PM',
      },
    ],
  },
  {
    id: 'conv-3',
    contact: {
      id: 3,
      name: 'Lisa Park',
      company: 'Growth Labs',
      email: 'lisa@growthlabs.com',
      points: 1540,
      tags: ['Agency'],
    },
    type: 'email',
    lastMessage: 'Can we schedule a demo for next Tuesday?',
    timestamp: 'Yesterday',
    unread: true,
    messages: [
      {
        id: 'm5',
        direction: 'received',
        content:
          "Hi there! I saw your platform and I'm really interested. Can we schedule a demo for next Tuesday?",
        timestamp: 'Yesterday 4:15 PM',
      },
    ],
  },
  {
    id: 'conv-4',
    contact: {
      id: 4,
      name: 'James Wilson',
      company: 'Innovate Inc',
      email: 'james@innovate.co',
      points: 1290,
    },
    type: 'sms',
    lastMessage: 'Got it, see you at 2pm tomorrow!',
    timestamp: '2 days ago',
    unread: false,
    messages: [
      {
        id: 'm6',
        direction: 'sent',
        content:
          'Hi James, confirming our meeting tomorrow at 2pm. Looking forward to it!',
        timestamp: '2 days ago 10:00 AM',
      },
      {
        id: 'm7',
        direction: 'received',
        content: 'Got it, see you at 2pm tomorrow!',
        timestamp: '2 days ago 10:05 AM',
      },
    ],
  },
  {
    id: 'conv-5',
    contact: {
      id: 5,
      name: 'Emma Davis',
      company: 'Scale Up',
      email: 'emma@scaleup.dev',
      points: 1105,
      tags: ['Trial'],
    },
    type: 'email',
    lastMessage: 'Love the product! Quick question about the API...',
    timestamp: '3 days ago',
    unread: false,
    messages: [
      {
        id: 'm8',
        direction: 'received',
        content:
          'Love the product! Quick question about the API — do you support webhooks for contact updates?',
        timestamp: '3 days ago 9:00 AM',
      },
      {
        id: 'm9',
        direction: 'sent',
        content:
          "Hi Emma! Yes, we support webhooks. You can configure them in Settings > Integrations > Webhooks. Let me know if you need help setting them up!",
        timestamp: '3 days ago 11:30 AM',
      },
      {
        id: 'm10',
        direction: 'received',
        content: "Perfect, I'll check it out. Thanks!",
        timestamp: '3 days ago 12:00 PM',
      },
    ],
  },
];

function DragHandle({
  onDrag,
}: {
  onDrag: (deltaX: number) => void;
}) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastX.current = e.clientX;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - lastX.current;
        lastX.current = ev.clientX;
        onDrag(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onDrag]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 flex-shrink-0 cursor-col-resize group relative hover:bg-indigo-500/30 transition-colors"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(288);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredConversations =
    filter === 'all'
      ? DEMO_CONVERSATIONS
      : DEMO_CONVERSATIONS.filter((c) => c.type === filter);

  const selectedConversation =
    DEMO_CONVERSATIONS.find((c) => c.id === selectedId) || null;

  const handleLeftDrag = useCallback((delta: number) => {
    setLeftWidth((prev) => Math.max(200, Math.min(500, prev + delta)));
  }, []);

  const handleRightDrag = useCallback((delta: number) => {
    setRightWidth((prev) => Math.max(200, Math.min(500, prev - delta)));
  }, []);

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-120px)]">
      <div style={{ width: leftWidth, minWidth: 200, maxWidth: 500 }} className="flex-shrink-0">
        <ConversationList
          conversations={filteredConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>
      <DragHandle onDrag={handleLeftDrag} />
      <div className="flex-1 min-w-[300px]">
        <MessageThread conversation={selectedConversation} />
      </div>
      <DragHandle onDrag={handleRightDrag} />
      <div style={{ width: rightWidth, minWidth: 200, maxWidth: 500 }} className="flex-shrink-0">
        <ContactSidebar contact={selectedConversation?.contact || null} />
      </div>
    </div>
  );
}
