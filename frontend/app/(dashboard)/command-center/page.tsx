'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '@/lib/api/chat';

interface ToolResult {
  tool: string;
  status: 'success' | 'error';
  summary: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  toolResults?: ToolResult[];
  toolsUsed?: string[];
}

const SUGGESTIONS = [
  { icon: '\u{1F4CA}', label: 'CRM Overview', prompt: 'Show me my CRM overview' },
  { icon: '\u{1F465}', label: 'Top Contacts', prompt: 'Show me my top 10 contacts' },
  { icon: '\u{1F4E7}', label: 'Create Email', prompt: 'Create a welcome email for new subscribers' },
  { icon: '\u{1F3AF}', label: 'Campaigns', prompt: 'Show me active campaigns' },
];

const TOOL_ICONS: Record<string, string> = {
  get_contacts: '\u{1F465}',
  create_email: '\u{1F4E7}',
  get_campaigns: '\u{1F3AF}',
  get_segments: '\u{2705}',
  send_email: '\u{1F4E8}',
  create_contact: '\u{1F464}',
};

export default function CommandCenterPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const hasMessages = messages.length > 0;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }
      setInput(transcript);
      if (isFinal) {
        setIsRecording(false);
        inputRef.current?.focus();
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  const sendMessage = useCallback(async () => {
    const currentInput = input;
    if (!currentInput.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await sendChatMessage(currentInput);
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: data.response || data.message || 'No response received.',
        toolResults: data.tool_results?.map((tr) => ({
          tool: tr.tool,
          status: (tr.success ? 'success' : 'error') as 'success' | 'error',
          summary: tr.display || '',
        })),
        toolsUsed: data.tools_used,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMessage =
        err instanceof Error && err.message.includes('401')
          ? 'Sign in to use the AI Command Center.'
          : 'Unable to reach LeadSpot AI. Please check that the backend is running.';
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-indigo-500/[0.04] to-transparent pointer-events-none" />

      {/* Messages Area */}
      <div
        className={`flex-1 overflow-y-auto px-6 py-8 scroll-smooth ${
          hasMessages ? '' : 'flex items-center justify-center'
        }`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--tw-border-opacity, #3f3f46) transparent' }}
      >
        {!hasMessages ? (
          /* Welcome State */
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-5 duration-500">
            {/* AI Ready Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/25 rounded-full text-xs font-medium text-indigo-500 dark:text-indigo-400 mb-6">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              AI Agent Ready
            </div>

            <h1 className="text-[32px] font-bold text-slate-900 dark:text-zinc-50 mb-3">
              What can I help you with?
            </h1>
            <p className="text-base text-slate-500 dark:text-zinc-400 max-w-[500px] leading-relaxed mb-7">
              I can manage contacts, create campaigns, send emails, and automate your marketing workflows.
            </p>

            {/* Suggestion Buttons */}
            <div className="grid grid-cols-2 gap-3 max-w-[480px] w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestionClick(s.prompt)}
                  className="flex items-center gap-3 px-5 py-4 bg-white/90 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/50 rounded-xl text-sm font-medium text-slate-900 dark:text-zinc-50 text-left transition-all hover:border-indigo-400 dark:hover:border-indigo-400 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-400/10"
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="flex-1">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="max-w-[700px] mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'bot'
                      ? 'bg-gradient-to-br from-indigo-500 via-indigo-400 to-indigo-300 text-white'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {msg.role === 'bot' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="max-w-[75%]">
                  <div
                    className={`px-4 py-3.5 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-500 via-indigo-400 to-indigo-300 text-white'
                        : 'bg-white/90 dark:bg-zinc-800/80 border border-indigo-200 dark:border-indigo-400/20 text-slate-900 dark:text-zinc-50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Tool Results */}
                  {msg.toolResults && msg.toolResults.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {msg.toolResults.map((tool, i) => (
                        <div
                          key={i}
                          className="px-4 py-3.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/50 rounded-xl animate-in slide-in-from-left-2 duration-300"
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <span className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded-lg text-sm">
                              {TOOL_ICONS[tool.tool] || '\u{1F527}'}
                            </span>
                            <span className="flex-1 text-[13px] font-semibold text-slate-900 dark:text-zinc-50 capitalize">
                              {tool.tool.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide ${
                                tool.status === 'success'
                                  ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
                              }`}
                            >
                              {tool.status}
                            </span>
                          </div>
                          <p className="text-[13px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                            {tool.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3 animate-in fade-in duration-300">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 via-indigo-400 to-indigo-300 rounded-lg flex items-center justify-center text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z" />
                  </svg>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:200ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:400ms]" />
                </div>
                <span className="text-[13px] text-zinc-400 italic">LeadSpot is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-6 pb-8 pt-4">
        <form onSubmit={handleSubmit} className="max-w-[700px] mx-auto">
          <div className="flex items-center bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/50 rounded-full p-1 transition-all focus-within:border-indigo-400 dark:focus-within:border-indigo-400 focus-within:ring-[3px] focus-within:ring-indigo-400/10">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? 'Listening...' : 'Ask me anything about your CRM...'}
              className="flex-1 px-5 py-3 bg-transparent border-none text-slate-900 dark:text-zinc-50 text-[15px] outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
              disabled={isLoading}
              autoComplete="off"
            />

            {/* Voice Button */}
            <button
              type="button"
              onClick={toggleVoice}
              disabled={!speechSupported}
              className={`w-10 h-10 rounded-full flex items-center justify-center mr-1 transition-all ${
                !speechSupported
                  ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-zinc-800 text-slate-400'
                  : isRecording
                    ? 'bg-red-500/15 text-red-500 animate-pulse'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
              title={!speechSupported ? 'Voice input not supported' : isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-400 to-indigo-300 text-white flex items-center justify-center transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-400/35 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
