import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Pre-set env vars so module-level code that reads process.env on import
    // (e.g. `const stripe = STRIPE_SECRET_KEY ? new Stripe(...) : null`)
    // sees the expected values before any test file is imported.
    env: {
      STRIPE_SECRET_KEY: 'sk_test_vitest_fake_key',
      MAUTIC_TOKEN_ENCRYPTION_KEY: '', // overridden per-test in mautic-token-db
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
