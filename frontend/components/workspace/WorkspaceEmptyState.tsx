'use client';

import React from 'react';

interface WorkspaceEmptyStateProps {
  isNewAccount?: boolean;
  onAddFirstContact?: () => void;
}

export function WorkspaceEmptyState({ isNewAccount, onAddFirstContact }: WorkspaceEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/50">
        <svg className="h-8 w-8 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      </div>
      {isNewAccount ? (
        <>
          <div>
            <p className="text-base font-semibold text-zinc-200">Add your first contact to get started</p>
            <p className="mt-2 text-sm text-zinc-500">
              Your workspace will come alive once you have contacts. Add one to see your Hot Leads Board, Pipeline, and Morning Brief.
            </p>
          </div>
          {onAddFirstContact && (
            <button
              onClick={onAddFirstContact}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            >
              Add first contact
            </button>
          )}
        </>
      ) : (
        <div>
          <p className="text-base font-semibold text-zinc-200">Your workspace is loading</p>
          <p className="mt-2 text-sm text-zinc-500">
            Hang tight while we set up your personalized workspace.
          </p>
        </div>
      )}
    </div>
  );
}
