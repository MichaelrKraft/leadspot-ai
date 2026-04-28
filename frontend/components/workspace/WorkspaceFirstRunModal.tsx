'use client';

import React, { useState, useEffect } from 'react';

interface SetupItem {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

interface WorkspaceFirstRunModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const SETUP_ITEMS: SetupItem[] = [
  { label: 'Setting up your Hot Leads Board...', status: 'pending' },
  { label: 'Building your Listing Pipeline...', status: 'pending' },
  { label: 'Preparing your Morning Brief...', status: 'pending' },
  { label: 'Activating your Farming Zone...', status: 'pending' },
];

export function WorkspaceFirstRunModal({ onComplete, onSkip }: WorkspaceFirstRunModalProps) {
  const [items, setItems] = useState<SetupItem[]>(SETUP_ITEMS);
  const [phase, setPhase] = useState<'setup' | 'done'>('setup');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const runSetup = async () => {
      for (let i = 0; i < SETUP_ITEMS.length; i++) {
        if (cancelled) return;

        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'loading' } : item
        ));

        await new Promise(res => setTimeout(res, 1200 + Math.random() * 800));

        if (cancelled) return;
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'done' } : item
        ));
      }

      if (cancelled) return;
      setPhase('done');

      await new Promise(res => setTimeout(res, 2000));
      if (cancelled) return;

      setVisible(false);
      await new Promise(res => setTimeout(res, 400));
      onComplete();
    };

    runSetup();
    return () => { cancelled = true; };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-400 ${phase === 'done' ? 'opacity-0' : 'opacity-100'}`}>
      <div className="w-full max-w-[520px] rounded-2xl border border-zinc-800 bg-[#111118] p-8 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-indigo-500/20">
            <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Your Workspace is being built.</h2>
          <p className="text-sm text-zinc-400">Personalizing your AI-powered CRM dashboard&hellip;</p>
        </div>

        {/* Setup items */}
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {item.status === 'done' && (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {item.status === 'loading' && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                )}
                {item.status === 'error' && (
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                {item.status === 'pending' && (
                  <div className="h-4 w-4 rounded-full border border-zinc-600" />
                )}
              </div>
              <span className={`text-sm ${item.status === 'done' ? 'text-zinc-300' : item.status === 'loading' ? 'text-white' : 'text-zinc-500'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Skip button */}
        <div className="mt-6 text-center">
          <button
            onClick={onSkip}
            className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            Skip setup
          </button>
        </div>
      </div>
    </div>
  );
}
