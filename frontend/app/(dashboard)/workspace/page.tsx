'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSpaceAgentHealth } from '@/hooks/useSpaceAgentHealth';
import { useWorkspaceMessaging } from '@/hooks/useWorkspaceMessaging';
import { WorkspaceFirstRunModal } from '@/components/workspace/WorkspaceFirstRunModal';

const SPACE_AGENT_ENABLED = process.env.NEXT_PUBLIC_SPACE_AGENT_ENABLED === 'true';
const SPACE_AGENT_MOUNT = '/space';
const READY_TIMEOUT_MS = 8000;

type WorkspaceState = 'loading' | 'ready' | 'blocked' | 'error' | 'starting';

interface WorkspaceToken {
  workspace_token: string;
  reused: boolean;
}

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [state, setState] = useState<WorkspaceState>('loading');
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [reconnectBanner, setReconnectBanner] = useState(false);
  const [skillUpdateBanner, setSkillUpdateBanner] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string>('');
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFirstRun = searchParams?.get('first_run') === '1';

  const { status: healthStatus } = useSpaceAgentHealth(SPACE_AGENT_ENABLED);

  // Token exchange
  const fetchToken = useCallback(async (): Promise<WorkspaceToken | null> => {
    try {
      const res = await fetch('/auth/workspace-token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body?.detail || '';
        } catch { /* body wasn't JSON */ }
        console.error('[workspace] token fetch failed', res.status, detail);
        setErrorDetail(detail || `HTTP ${res.status}`);
        setState('error');
        return null;
      }
      setErrorDetail('');
      return await res.json();
    } catch (e) {
      console.error('[workspace] token fetch threw', e);
      setErrorDetail(e instanceof Error ? e.message : 'Network error');
      setState('error');
      return null;
    }
  }, []);

  // Build iframe src and initialize
  const initWorkspace = useCallback(async () => {
    if (!SPACE_AGENT_ENABLED) {
      setState('error');
      return;
    }

    setState('loading');

    const tokenData = await fetchToken();
    if (!tokenData) return;

    const ctx = {
      organizationId: user?.organizationId || '',
      userId: user?.id || '',
      userName: user?.name || user?.email || '',
    };

    const ctxB64 = btoa(JSON.stringify(ctx));
    // Hit /_sa/login directly — Space Agent's pages_handler will serve login.html
    // with our SSO bootstrap, which exchanges the wt for a session cookie and
    // then location.replace("/") (caught by the runtime monkey-patch and rewritten
    // to "/_sa/").
    const src = `${SPACE_AGENT_MOUNT}/login?wt=${encodeURIComponent(tokenData.workspace_token)}&ctx=${encodeURIComponent(ctxB64)}&theme=dark`;
    setIframeSrc(src);

    // Start ready timeout — if READY postMessage doesn't arrive, assume blocked
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    readyTimeoutRef.current = setTimeout(() => {
      setState(prev => prev === 'loading' ? 'blocked' : prev);
    }, READY_TIMEOUT_MS);
  }, [fetchToken, user]);

  useEffect(() => {
    initWorkspace();
    return () => {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, [initWorkspace]);

  useEffect(() => {
    if (isFirstRun) setShowFirstRun(true);
  }, [isFirstRun]);

  // BroadcastChannel: relay cross-tab NAVIGATE messages into the iframe
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let bc: BroadcastChannel;
    try {
      bc = new BroadcastChannel('leadspot-workspace');
      bc.onmessage = (e) => {
        if (e.data?.type === 'NAVIGATE' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'NAVIGATE', payload: e.data.payload },
            window.location.origin
          );
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      try { bc?.close(); } catch { /* ignore */ }
    };
  }, [iframeRef]);

  // Handle token refresh request from Space Agent
  const handleTokenRefreshRequest = useCallback(async () => {
    const tokenData = await fetchToken();
    if (tokenData && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'TOKEN_REFRESH_RESPONSE', payload: { token: tokenData.workspace_token } },
        window.location.origin
      );
    }
  }, [fetchToken]);

  useWorkspaceMessaging({
    iframeRef,
    onReady: () => {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      setState('ready');
    },
    onNavigateCRM: (path) => path && router.push(path),
    onSessionExpired: () => setSessionExpired(true),
    onTokenRefreshRequest: handleTokenRefreshRequest,
    onReconnect: () => setReconnectBanner(true),
    onSkillUpdated: (version) => setSkillUpdateBanner(version),
  });

  // sendMessage is exposed via the hook for programmatic use (e.g., parent navigating contact)

  const handleFirstRunComplete = useCallback(() => {
    setShowFirstRun(false);
    router.replace('/workspace');
  }, [router]);

  if (!SPACE_AGENT_ENABLED) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-zinc-400">Workspace is not enabled for your organization.</p>
        </div>
      </div>
    );
  }

  return (
    // h-[calc(100vh-9rem)] forces the iframe area to fill the viewport minus
    // the header (~73px) and footer (~49px). Using h-full here doesn't work
    // because <main> in the dashboard layout uses overflow-y-auto, which
    // makes h-full collapse to content height.
    <div className="relative flex h-[calc(100vh-9rem)] flex-col bg-[#0a0a0d]">
      {/* Mobile fallback — iframe is unusable on small screens */}
      <div className="md:hidden flex flex-col items-center justify-center h-full p-6 text-center">
        <h2 className="text-lg font-semibold text-zinc-200">Workspace Lite</h2>
        <p className="text-sm text-zinc-400 mt-2">Your full workspace is available on desktop. Mobile preview coming soon.</p>
        <a href="/workspace" target="_blank" className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400">Open Full Workspace</a>
      </div>

      {/* Desktop workspace — only renders >=768px */}
      <div className="hidden md:flex flex-1 flex-col min-h-0">
      {/* Zone A: Toolbar */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-zinc-800/50 bg-[#111118] px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">My Workspace</span>
          {state === 'ready' && (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
          )}
          {state === 'loading' && (
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          )}
        </div>
        <button
          onClick={() => {
            const iframe = iframeRef.current;
            if (iframe?.requestFullscreen) iframe.requestFullscreen();
          }}
          className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          title="Fullscreen"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>
      </div>

      {/* Zone B: Iframe area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading skeleton */}
        {state === 'loading' && (
          <div className="absolute inset-0 flex flex-col gap-4 p-6 animate-pulse">
            <div className="h-8 w-48 rounded-xl bg-zinc-800" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-2xl bg-zinc-800/60" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-zinc-800/40" />
          </div>
        )}

        {/* Blocked by extension */}
        {state === 'blocked' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-sm rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
              <p className="text-sm font-medium text-zinc-200">Workspace may be blocked by a browser extension</p>
              <p className="mt-2 text-xs text-zinc-500">Disable your ad blocker for this site, then refresh.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0d] min-h-[300px]">
            <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
              <p className="text-sm font-medium text-zinc-200">
                {healthStatus === 'down' ? 'Workspace is starting up…' : 'Workspace unavailable'}
              </p>
              {errorDetail && (
                <p className="mt-2 text-xs text-red-300 break-words">{errorDetail}</p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                {errorDetail.toLowerCase().includes('not enabled')
                  ? 'Contact your admin to enable My Workspace for your organization.'
                  : 'Usually takes a few seconds. Try again momentarily.'}
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={initWorkspace}
                  className="rounded-lg bg-indigo-500/20 px-4 py-2 text-xs font-medium text-indigo-400 hover:bg-indigo-500/30"
                >
                  Try Again
                </button>
                <a
                  href="/workspace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-700/50 px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Session expired overlay */}
        {sessionExpired && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="max-w-sm rounded-2xl border border-zinc-700 bg-[#111118] p-8 text-center">
              <p className="text-sm font-medium text-zinc-200">Session expired</p>
              <p className="mt-2 text-xs text-zinc-500">Your workspace is saved — log back in to continue.</p>
              <button
                onClick={() => { setSessionExpired(false); initWorkspace(); }}
                className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400"
              >
                Reconnect
              </button>
            </div>
          </div>
        )}

        {/* Reconnect banner */}
        {reconnectBanner && (
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-amber-900/80 px-4 py-2 text-xs text-amber-200">
            <span>Workspace restarted — click to reload</span>
            <div className="flex gap-2">
              <button onClick={initWorkspace} className="font-medium hover:underline">Reload</button>
              <button onClick={() => setReconnectBanner(false)} className="text-amber-400 hover:text-amber-200">&#x2715;</button>
            </div>
          </div>
        )}

        {/* Skill update banner */}
        {skillUpdateBanner && (
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-indigo-900/80 px-4 py-2 text-xs text-indigo-200">
            <span>Workspace has been updated — refresh to get the latest features.</span>
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()} className="font-medium hover:underline">Refresh</button>
              <button onClick={() => setSkillUpdateBanner(null)} className="text-indigo-400 hover:text-indigo-200">&#x2715;</button>
            </div>
          </div>
        )}

        {/* The iframe */}
        {iframeSrc && (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className={`h-full w-full border-none bg-transparent transition-opacity duration-300 ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            title="AI Workspace"
          />
        )}
      </div>
      </div>

      {/* First run modal */}
      {showFirstRun && (
        <WorkspaceFirstRunModal
          onComplete={handleFirstRunComplete}
          onSkip={handleFirstRunComplete}
        />
      )}
    </div>
  );
}

const WorkspaceSkeleton = () => (
  <div className="flex h-full animate-pulse flex-col gap-4 bg-[#0a0a0d] p-6">
    <div className="h-8 w-48 rounded-xl bg-zinc-800" />
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-48 rounded-2xl bg-zinc-800/60" />
      ))}
    </div>
  </div>
);

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <WorkspaceContent />
    </Suspense>
  );
}
