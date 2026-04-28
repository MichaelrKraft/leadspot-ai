'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  signal_id: string;
  snippet: string;
}

interface ToolCallEvent {
  tool: string;
  args: Record<string, unknown>;
}

interface ToolResultEvent {
  tool: string;
  result_summary: string;
}

interface NeedsConfirmEvent {
  action: string;
  args: Record<string, unknown>;
  confirm_phrase: string;
}

interface AssistantEvent {
  text: string;
  citations: Citation[];
}

interface DoneEvent {
  thread_id: string;
  total_tokens: number;
}

type StreamEvent =
  | { type: 'thinking'; data: string }
  | { type: 'tool_call'; data: ToolCallEvent }
  | { type: 'tool_result'; data: ToolResultEvent }
  | { type: 'needs_confirm'; data: NeedsConfirmEvent }
  | { type: 'assistant'; data: AssistantEvent }
  | { type: 'done'; data: DoneEvent };

// ---------------------------------------------------------------------------
// SSE consumer
//
// Custom-rolled fetch-based stream parser. EventSource doesn't support POST
// requests with a JSON body or Authorization headers, so we use fetch +
// ReadableStream and parse text/event-stream by hand.
// ---------------------------------------------------------------------------

async function* readSSE(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIdx: number;
    while ((separatorIdx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, separatorIdx);
      buffer = buffer.slice(separatorIdx + 2);
      const parsed = parseSSEChunk(chunk);
      if (parsed) yield parsed;
    }
  }
  if (buffer.trim()) {
    const parsed = parseSSEChunk(buffer);
    if (parsed) yield parsed;
  }
}

function parseSSEChunk(chunk: string): StreamEvent | null {
  let event = '';
  let dataLine = '';
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
  }
  if (!event) return null;
  let data: unknown;
  try {
    data = dataLine ? JSON.parse(dataLine) : null;
  } catch {
    data = dataLine;
  }
  switch (event) {
    case 'thinking':
      return { type: 'thinking', data: String(data ?? '') };
    case 'tool_call':
      return { type: 'tool_call', data: data as ToolCallEvent };
    case 'tool_result':
      return { type: 'tool_result', data: data as ToolResultEvent };
    case 'needs_confirm':
      return { type: 'needs_confirm', data: data as NeedsConfirmEvent };
    case 'assistant':
      return { type: 'assistant', data: data as AssistantEvent };
    case 'done':
      return { type: 'done', data: data as DoneEvent };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  /** Optional override; defaults to the global `Cmd/Ctrl+K` listener. */
  defaultOpen?: boolean;
}

export default function CommandPalette({ defaultOpen = false }: CommandPaletteProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [thinkingMsgs, setThinkingMsgs] = useState<string[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolResultEvent[]>([]);
  const [assistantText, setAssistantText] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<NeedsConfirmEvent | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deep, setDeep] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useAuthStore((s) => s.token);

  // ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const triggered = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (triggered) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus the input on open.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Cancel any pending close timer when the user reopens / interacts.
  useEffect(() => {
    if (!open && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, [open]);

  const resetTurn = useCallback(() => {
    setThinkingMsgs([]);
    setToolEvents([]);
    setAssistantText('');
    setCitations([]);
    setPendingConfirm(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setInput('');
    resetTurn();
  }, [resetTurn]);

  const submit = useCallback(
    async (message: string, confirmedAction: string | null) => {
      if (!message.trim()) return;
      resetTurn();
      setStreaming(true);

      try {
        const res = await fetch('/api/v2/chat', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message,
            thread_id: threadId,
            deep,
            confirmed_action: confirmedAction,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          setError(`Request failed (${res.status}): ${body.slice(0, 200)}`);
          return;
        }

        for await (const evt of readSSE(res)) {
          if (evt.type === 'thinking') {
            setThinkingMsgs((prev) => [...prev, evt.data]);
          } else if (evt.type === 'tool_result') {
            setToolEvents((prev) => [...prev, evt.data]);
          } else if (evt.type === 'needs_confirm') {
            setPendingConfirm(evt.data);
          } else if (evt.type === 'assistant') {
            setAssistantText(evt.data.text);
            setCitations(evt.data.citations || []);
          } else if (evt.type === 'done') {
            setThreadId(evt.data.thread_id);
            // Auto-close 3s after a clean done event, unless the user has a
            // pending confirmation to make a decision on.
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
              setPendingConfirm((current) => {
                if (current === null) close();
                return current;
              });
            }, 3000);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStreaming(false);
      }
    },
    [close, deep, resetTurn, threadId, token],
  );

  const handleConfirm = useCallback(
    (phrase: string) => {
      if (!pendingConfirm || !input) return;
      void submit(input, phrase);
    },
    [pendingConfirm, input, submit],
  );

  const renderedAssistant = useMemo(
    () => renderAssistantText(assistantText, citations),
    [assistantText, citations],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LeadSpot command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
    >
      <div className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.10),0_4px_12px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1018]">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6D28D9 0%, #06B6D4 100%)' }}
          >
            AI
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !streaming) {
                void submit(input, null);
              }
            }}
            placeholder="Ask anything about your CRM…"
            disabled={streaming}
            className="font-mono flex-1 bg-transparent text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
            style={{
              caretColor: '#6D28D9',
            }}
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
              className="h-3 w-3 accent-violet-600"
            />
            <span className="font-mono">/deep</span>
          </label>
          <kbd className="font-mono rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            esc
          </kbd>
        </div>

        {/* Streaming results */}
        <div className="max-h-[60vh] overflow-y-auto bg-[#F5F4F1] dark:bg-[#0a0a0d]">
          {/* Tool activity */}
          {toolEvents.length > 0 && (
            <div className="border-b border-slate-200 px-5 py-3 dark:border-white/10">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Activity
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {toolEvents.map((t, i) => (
                  <li key={i} className="font-mono">
                    <span className="text-violet-600 dark:text-violet-400">{t.tool}</span>
                    {' → '}
                    <span className="text-slate-500 dark:text-slate-400">{t.result_summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Thinking text */}
          {thinkingMsgs.length > 0 && (
            <div className="border-b border-slate-200 px-5 py-3 text-sm italic text-slate-500 dark:border-white/10 dark:text-slate-400">
              {thinkingMsgs.join(' ')}
            </div>
          )}

          {/* Assistant text */}
          {assistantText && (
            <div className="px-5 py-4 text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
              {renderedAssistant}
            </div>
          )}

          {/* Confirmation chips */}
          {pendingConfirm && (
            <div className="border-t border-amber-300/70 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="text-sm text-slate-800 dark:text-slate-200">
                Confirm action: <span className="font-mono font-semibold">{pendingConfirm.action}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleConfirm(pendingConfirm.confirm_phrase)}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Type &quot;{pendingConfirm.confirm_phrase}&quot;
                </button>
                <button
                  onClick={() => {
                    setPendingConfirm(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="border-t border-red-300/70 bg-red-50 px-5 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!toolEvents.length && !thinkingMsgs.length && !assistantText && !error && !streaming && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Try: <span className="font-mono">&quot;which deals are likely to slip this week?&quot;</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation rendering — attaches `[1]`, `[2]` chips to factual claims.
// Strategy: append a numbered chip after the response text for each citation,
// rather than trying to inline-position by offset (which would require the
// model to emit positional markers, a Phase 4 problem).
// ---------------------------------------------------------------------------

function renderAssistantText(text: string, citations: Citation[]): React.ReactNode {
  if (!text && !citations.length) return null;
  return (
    <>
      <span>{text}</span>
      {citations.length > 0 && (
        <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
          {citations.map((c, i) => (
            <CitationChip key={c.signal_id} index={i + 1} citation={c} />
          ))}
        </span>
      )}
    </>
  );
}

function CitationChip({ index, citation }: { index: number; citation: Citation }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        className="font-mono inline-flex h-[18px] min-w-[18px] cursor-pointer items-center justify-center rounded-full border border-violet-300 bg-violet-100 px-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-200 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-200"
      >
        {index}
      </span>
      {hover && (
        <span className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#1a1b25]">
          <span className="font-mono block text-[10px] text-slate-400">
            {citation.signal_id.slice(0, 8)}…
          </span>
          <span className="mt-1 block text-slate-700 dark:text-slate-200">{citation.snippet || '(no snippet)'}</span>
        </span>
      )}
    </span>
  );
}
