const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
  },
  // API configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/:path*',
      },
    ];
  },
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: 'InnoSynth.ai',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
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
