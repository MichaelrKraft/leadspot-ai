const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Strict Mode causes the workspace iframe to remount in dev, which thrashes
  // the SSO redirect chain (each remount re-fetches /space/login). Production
  // doesn't run Strict Mode in dev-double-invocation form anyway.
  reactStrictMode: false,
  swcMinify: true,
  images: {
    domains: [],
  },
  // API configuration
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      // /api/agent/* intentionally goes through the backend (below), whose
      // authenticated proxy adds the internal key agent-service requires.
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
    ];
  },
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: 'LeadSpot.ai',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
    NEXT_PUBLIC_SPACE_AGENT_ENABLED: process.env.NEXT_PUBLIC_SPACE_AGENT_ENABLED || 'false',
    // Default to empty string so all client-side fetch calls use relative URLs,
    // which Next.js rewrites proxy to the backend at runtime. Avoids baking
    // localhost:8000 into the Docker bundle when the env var isn't set at build time.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    // Mirrors the backend DEMO_LOGIN_ENABLED flag; controls whether the
    // "Explore Demo" button is shown on the login page.
    NEXT_PUBLIC_DEMO_LOGIN_ENABLED: process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED || 'false',
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Upload source maps only in production
  dryRun: process.env.NODE_ENV !== 'production',
  // Disable Sentry telemetry
  telemetry: false,
};

// Only wrap with Sentry if DSN is configured
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
