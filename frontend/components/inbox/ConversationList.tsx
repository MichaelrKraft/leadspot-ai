'use client';

import { Conversation, FilterType } from '@/types/inbox';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Email', value: 'email' },
  { label: 'SMS', value: 'sms' },
  { label: 'Chat', value: 'chat' },
];

function TypeIcon({ type }: { type: Conversation['type'] }) {
  if (type === 'email') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
    );
  }
  if (type === 'sms') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-blue-500',
    'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
}: ConversationListProps) {
  return (
    <div className="w-full border-r dark:border-zinc-800/50 border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b dark:border-zinc-800/50 border-slate-200">
        <h2 className="text-lg font-semibold dark:text-zinc-100 text-slate-900 mb-3">
          Inbox
        </h2>

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === f.value
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/30 dark:hover:bg-zinc-800/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Placeholder */}
        <div className="mt-3 relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg dark:bg-zinc-800/50 bg-slate-100 dark:border-zinc-700/50 border-slate-200 border dark:text-zinc-200 text-slate-800 dark:placeholder-zinc-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500">
            No conversations found.
          </div>
        )}
        {conversations.map((conv) => {
          const isSelected = conv.id === selectedId;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/30 ${
                isSelected
                  ? 'border-l-2 border-indigo-400 bg-indigo-500/5'
                  : 'border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getAvatarColor(
                    conv.contact.name
                  )}`}
                >
                  {conv.contact.name.charAt(0)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm truncate ${
                        conv.unread
                          ? 'font-semibold dark:text-zinc-100 text-slate-900'
                          : 'font-medium dark:text-zinc-300 text-slate-700'
                      }`}
                    >
                      {conv.contact.name}
                    </span>
                    <span className="flex-shrink-0 text-xs text-zinc-500">
                      {conv.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <TypeIcon type={conv.type} />
                    <p className="text-xs dark:text-zinc-400 text-slate-500 truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                </div>

                {/* Unread Dot */}
                {conv.unread && (
                  <div className="flex-shrink-0 mt-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
