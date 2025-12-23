/**
 * Sentry edge runtime configuration for Next.js
 * This file configures Sentry for Edge runtime (middleware, edge API routes).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment and release
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
    release: `innosynth-frontend@${process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}`,

    // Performance Monitoring (lower for edge)
    tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.01 : 0.05,

    // Debug mode (only in development)
    debug: process.env.NODE_ENV === 'development',
  });
}
