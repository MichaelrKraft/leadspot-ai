'use client';

import { useEffect, useRef } from 'react';
import { Conversation } from '@/types/inbox';

interface MessageThreadProps {
  conversation: Conversation | null;
}

export default function MessageThread({ conversation }: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col h-full items-center justify-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-zinc-600 mb-4"
        >
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z" />
        </svg>
        <p className="text-sm dark:text-zinc-500 text-slate-400">
          Select a conversation to view messages
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Thread Header */}
      <div className="px-6 py-4 border-b dark:border-zinc-800/50 border-slate-200 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold dark:text-zinc-100 text-slate-900 truncate">
            {conversation.contact.name}
          </h3>
          <p className="text-xs dark:text-zinc-400 text-slate-500">
            {conversation.contact.company} &middot;{' '}
            <span className="capitalize">{conversation.type}</span>
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {conversation.messages.map((msg) => {
          const isSent = msg.direction === 'sent';
          return (
            <div
              key={msg.id}
              className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[75%]">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    isSent
                      ? 'bg-gradient-to-br from-indigo-500 via-indigo-400 to-indigo-300 text-white'
                      : 'dark:bg-zinc-800 bg-slate-100 dark:border dark:border-zinc-700/50 border border-slate-200 dark:text-zinc-200 text-slate-800'
                  }`}
                >
                  {msg.content}
                </div>
                <p
                  className={`text-[11px] mt-1.5 dark:text-zinc-500 text-slate-400 ${
                    isSent ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Area */}
      <div className="p-4 border-t dark:border-zinc-800/50 border-slate-200">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Replies coming soon..."
            disabled
            className="flex-1 px-4 py-2.5 text-sm rounded-xl dark:bg-zinc-800/50 bg-slate-100 dark:border-zinc-700/50 border-slate-200 border dark:text-zinc-400 text-slate-400 placeholder-zinc-500 cursor-not-allowed"
          />
          <button
            disabled
            className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 cursor-not-allowed opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
