'use client';

// TODO: Wire to backend inbox API
// Required endpoints (not yet implemented in backend):
//   GET  /api/conversations           — list conversations with pagination
//   GET  /api/conversations/:id       — get single conversation with messages
//   POST /api/conversations/:id/reply — send a reply (email or SMS)
//   POST /api/conversations           — compose new message
// Until these exist, mock data (DEMO_CONVERSATIONS) is used below.
// Empty state placeholder: "No messages yet. Your email and SMS conversations will appear here."

import { useState, useCallback, useRef, useEffect } from 'react';
import { PenSquare, X, Send } from 'lucide-react';
import ConversationList from '@/components/inbox/ConversationList';
import MessageThread from '@/components/inbox/MessageThread';
import ContactSidebar from '@/components/inbox/ContactSidebar';
import { Conversation, FilterType } from '@/types/inbox';
import {
  listConversations,
  getConversation,
  replyToConversation,
  createConversation,
} from '@/lib/api/conversations';

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(288);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '', type: 'email' as 'email' | 'sms' });
  useEffect(() => {
    listConversations()
      .then((data) => setConversations(data))
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredConversations =
    filter === 'all'
      ? conversations
      : conversations.filter((c) => c.type === filter);

  const selectedConversation =
    conversations.find((c) => c.id === selectedId) || null;

  const handleLeftDrag = useCallback((delta: number) => {
    setLeftWidth((prev) => Math.max(200, Math.min(500, prev + delta)));
  }, []);

  const handleRightDrag = useCallback((delta: number) => {
    setRightWidth((prev) => Math.max(200, Math.min(500, prev - delta)));
  }, []);

  const handleComposeSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newConvo = await createConversation({
        type: composeForm.type,
        contact_name: composeForm.to,
        contact_email: composeForm.type === 'email' ? composeForm.to : undefined,
        contact_phone: composeForm.type === 'sms' ? composeForm.to : undefined,
        subject: composeForm.subject || undefined,
        first_message: composeForm.body,
      });
      setConversations((prev) => [newConvo, ...prev]);
      setSelectedId(newConvo.id);
    } catch {
      // non-fatal — still close modal
    }
    setComposeForm({ to: '', subject: '', body: '', type: 'email' });
    setShowCompose(false);
  };

  const handleReply = async (conversationId: string, body: string) => {
    if (!body.trim()) return;
    try {
      const newMsg = await replyToConversation(conversationId, body);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: body, messages: [...c.messages, newMsg] }
            : c
        )
      );
    } catch {
      // non-fatal
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-120px)] relative">
      {/* Compose FAB */}
      <button
        onClick={() => setShowCompose(true)}
        className="absolute bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
      >
        <PenSquare className="h-4 w-4" />
        Compose
      </button>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-y-0 left-[220px] right-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Message</h2>
              <button onClick={() => setShowCompose(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleComposeSend} className="space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                {(['email', 'sms'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setComposeForm(p => ({ ...p, type: t }))}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                      composeForm.type === t
                        ? 'bg-indigo-500 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t === 'email' ? 'Email' : 'SMS'}
                  </button>
                ))}
              </div>

              {/* To */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">To *</label>
                <input
                  required
                  type={composeForm.type === 'email' ? 'email' : 'text'}
                  value={composeForm.to}
                  onChange={e => setComposeForm(p => ({ ...p, to: e.target.value }))}
                  placeholder={composeForm.type === 'email' ? 'recipient@example.com' : '+1 555-0123'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* Subject (email only) */}
              {composeForm.type === 'email' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Subject *</label>
                  <input
                    required
                    value={composeForm.subject}
                    onChange={e => setComposeForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Email subject"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              )}

              {/* Body */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Message *</label>
                <textarea
                  required
                  rows={composeForm.type === 'email' ? 8 : 3}
                  value={composeForm.body}
                  onChange={e => setComposeForm(p => ({ ...p, body: e.target.value }))}
                  placeholder={composeForm.type === 'email' ? 'Write your email...' : 'Write your text message...'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCompose(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Discard
                </button>
                <button type="submit" className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500">
                  <Send className="h-4 w-4" />
                  {composeForm.type === 'email' ? 'Send Email' : 'Send SMS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        {filteredConversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8">
            <p className="text-base font-medium text-gray-300">No messages yet.</p>
            <p className="text-sm text-gray-500">Your email and SMS conversations will appear here.</p>
          </div>
        ) : (
          <MessageThread conversation={selectedConversation} onReply={handleReply} />
        )}
      </div>
      <DragHandle onDrag={handleRightDrag} />
      <div style={{ width: rightWidth, minWidth: 200, maxWidth: 500 }} className="flex-shrink-0">
        <ContactSidebar contact={selectedConversation?.contact || null} />
      </div>
    </div>
  );
}
