import { vi } from 'vitest';

// Global Prisma mock — every test file gets this automatically via setupFiles.
// Individual tests can override specific methods with mockResolvedValueOnce.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    billingTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    mauticToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    tenantMember: {
      findFirst: vi.fn(),
    },
    voiceUsage: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    voiceCall: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) =>
      fn({
        wallet: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        voiceUsage: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      }),
    ),
  },
}));

// Silence console output during tests to reduce noise.
// Tests that want to assert on logs can override these with vi.spyOn.
vi.spyOn(console, 'log').mockImplementation(() => undefined);
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
vi.spyOn(console, 'error').mockImplementation(() => undefined);
