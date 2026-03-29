import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * PrismaClient singleton for Next.js with PostgreSQL adapter
 * Prevents multiple instances in development due to hot reloading
 *
 * For Prisma 7.x, we use the adapter pattern with direct PostgreSQL connections
 * This avoids the HTTP connection limitations with Prisma Postgres
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool | undefined;
};

// During Next.js build, skip Prisma initialization to avoid connection errors
const isBuild = process.env.NEXT_PHASE === 'phase-production-build' ||
                process.env.npm_lifecycle_event === 'build';

function createPrismaClient(): PrismaClient {
  // Skip database connection during build
  if (isBuild) {
    console.log('⚠️  Skipping Prisma initialization during build');
    // Return a proxy that throws helpful errors if used during build
    return new Proxy({} as PrismaClient, {
      get: () => {
        throw new Error('Prisma client not available during build time');
      },
    });
  }

  // Use direct PostgreSQL connection for API routes
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DIRECT_DATABASE_URL or DATABASE_URL must be set');
  }

  // Create connection pool and adapter
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // Store pool globally to reuse connection
  globalForPrisma.pool = pool;

  // Create Prisma client with adapter
  // The adapter option is required for Prisma 7.x with PostgreSQL
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    adapter,
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown helper
 * Call this when your application is shutting down
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end();
  }
}

export default prisma;
