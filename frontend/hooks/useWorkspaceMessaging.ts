'use client';

import { useEffect, useCallback } from 'react';

export type LeadSpotMessageType =
  | 'CONTEXT'
  | 'NAVIGATE'
  | 'THEME_CHANGE'
  | 'TOKEN_REFRESH_RESPONSE'
  | 'SKILL_RELOAD';

export type SpaceAgentMessageType =
  | 'READY'
  | 'READY_CHECK'
  | 'RECONNECT'
  | 'NAVIGATE_CRM'
  | 'CONTACT_SELECTED'
  | 'WIDGET_ERROR'
  | 'SESSION_EXPIRED'
  | 'TOKEN_REFRESH_REQUEST'
  | 'SKILL_UPDATED';

interface UseWorkspaceMessagingOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onReady?: () => void;
  onNavigateCRM?: (path: string) => void;
  onContactSelected?: (contactId: string) => void;
  onWidgetError?: (widgetId: string, error: string) => void;
  onSessionExpired?: () => void;
  onTokenRefreshRequest?: () => void;
  onSkillUpdated?: (newVersion: string) => void;
  onReconnect?: () => void;
}

export function useWorkspaceMessaging({
  iframeRef,
  onReady,
  onNavigateCRM,
  onContactSelected,
  onWidgetError,
  onSessionExpired,
  onTokenRefreshRequest,
  onSkillUpdated,
  onReconnect,
}: UseWorkspaceMessagingOptions) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const spaceAgentOrigin =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SPACE_AGENT_URL
      ? process.env.NEXT_PUBLIC_SPACE_AGENT_URL
      : 'http://localhost:3009';

  const sendMessage = useCallback(
    (type: LeadSpotMessageType, payload?: unknown) => {
      // Send to the iframe at its actual cross-origin (Space Agent's origin),
      // not the parent's origin. Same-origin paths still work because the
      // browser short-circuits same-origin postMessage with any targetOrigin.
      iframeRef.current?.contentWindow?.postMessage({ type, payload }, spaceAgentOrigin);
    },
    [iframeRef, spaceAgentOrigin]
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Accept messages from the parent's own origin (legacy same-origin
      // proxy mode) AND from Space Agent's cross-origin URL. Reject anything
      // else.
      if (event.origin !== origin && event.origin !== spaceAgentOrigin) return;
      const { type, payload } = event.data || {};

      switch (type as SpaceAgentMessageType) {
        case 'READY':
          onReady?.();
          break;
        case 'NAVIGATE_CRM':
          onNavigateCRM?.(payload?.path);
          break;
        case 'CONTACT_SELECTED':
          onContactSelected?.(payload?.contactId);
          break;
        case 'WIDGET_ERROR':
          onWidgetError?.(payload?.widgetId, payload?.error);
          break;
        case 'SESSION_EXPIRED':
          onSessionExpired?.();
          break;
        case 'TOKEN_REFRESH_REQUEST':
          onTokenRefreshRequest?.();
          break;
        case 'SKILL_UPDATED':
          onSkillUpdated?.(payload?.newVersion);
          break;
        case 'RECONNECT':
          onReconnect?.();
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [origin, onReady, onNavigateCRM, onContactSelected, onWidgetError, onSessionExpired, onTokenRefreshRequest, onSkillUpdated, onReconnect]);

  return { sendMessage };
}
