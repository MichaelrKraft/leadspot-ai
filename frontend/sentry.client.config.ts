/**
 * Sentry client-side configuration for Next.js
 * This file configures Sentry for the browser/client environment.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment and release
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
    release: `innosynth-frontend@${process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}`,

    // Performance Monitoring
    tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.05 : 0.1,

    // Session Replay (optional - captures user sessions for debugging)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Debug mode (only in development)
    debug: process.env.NODE_ENV === 'development',

    // Filter out common non-actionable errors
    ignoreErrors: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      // Network errors that are usually transient
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // ResizeObserver errors (common, usually harmless)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    // Before sending event - filter or modify
    beforeSend(event, hint) {
      // Filter out errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames) {
        const frames = event.exception.values[0].stacktrace.frames;
        if (frames.some((frame) => frame.filename?.includes('extensions'))) {
          return null;
        }
      }
      return event;
    },
  });
}
