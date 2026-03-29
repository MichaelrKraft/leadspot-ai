# Prisma 7.x Setup Summary - Mautic Platform Dashboard

## Issue Resolved

Successfully configured Prisma Client 7.1.0 to work with local Prisma Postgres (`prisma dev`) using the PostgreSQL adapter pattern.

## Root Cause

Prisma Client 7.x with the `prisma+postgres://` connection string format requires either:
1. An `accelerateUrl` for remote Prisma Accelerate connections, OR
2. A database `adapter` for direct PostgreSQL connections

The local Prisma Postgres server (`prisma dev`) doesn't support HTTP connections from Prisma Client 7.x when using the default `prisma+postgres://` URL format.

## Solution

### 1. Extract Direct PostgreSQL URL

The `prisma+postgres://` URL contains a base64-encoded API key that includes the actual PostgreSQL connection string:

```bash
# Original URL (in DATABASE_URL)
prisma+postgres://localhost:51213/?api_key=...

# Decoded API key reveals:
{
  "databaseUrl": "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable..."
}
```

### 2. Configuration Changes

#### `.env`
Added direct PostgreSQL connection string:
```bash
DATABASE_URL="prisma+postgres://..."
DIRECT_DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
```

#### `prisma.config.ts`
Updated to use direct URL for migrations and CLI:
```typescript
datasource: {
  url: env("DIRECT_DATABASE_URL"),
}
```

#### `prisma/schema.prisma`
Removed `engineType` and `url` from schema (moved to config):
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

### 3. Adapter Pattern Implementation

#### Install Dependencies
```bash
npm install @prisma/adapter-pg pg
```

#### `prisma/seed.ts`
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  adapter,
});
```

#### `src/lib/prisma.ts`
Singleton pattern with adapter for Next.js API routes:
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DIRECT_DATABASE_URL;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  globalForPrisma.pool = pool;

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    adapter,
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

## Database Seeded Successfully

The seed script populated the database with:
- **5 users** (admin, instructor, 3 members)
- **1 community** (Mautic Masters)
- **5 community memberships**
- **3 posts** (announcement, question, discussion)
- **4 comments**
- **5 reactions**
- **1 course** with 2 modules and 4 lessons
- **2 course enrollments**
- **1 event** with 2 attendees
- **4 achievements**
- **3 point transactions**

## Usage in API Routes

```typescript
// app/api/users/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  const users = await prisma.user.findMany();
  return Response.json(users);
}
```

## Important Notes

1. **Two Connection Strings**: We maintain both URLs:
   - `DATABASE_URL`: For potential future Accelerate usage
   - `DIRECT_DATABASE_URL`: For current local development

2. **Connection Pooling**: The `pg.Pool` instance is reused across requests in the singleton pattern

3. **Graceful Shutdown**: Call `disconnectPrisma()` when shutting down:
   ```typescript
   import { disconnectPrisma } from '@/lib/prisma';

   process.on('SIGINT', async () => {
     await disconnectPrisma();
     process.exit(0);
   });
   ```

4. **Production Considerations**:
   - For production, consider using Prisma Accelerate with proper `accelerateUrl`
   - Or continue using direct connections with proper connection pooling
   - Update environment variables accordingly

## References

- [Prisma 7.x Client Configuration](https://pris.ly/d/prisma7-client-config)
- [PostgreSQL Adapter Documentation](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma Postgres Local Development](https://www.prisma.io/docs/orm/tools/prisma-postgres)

## Next Steps

1. ✅ Database schema created and migrated
2. ✅ Seed data populated
3. ✅ Prisma singleton configured for API routes
4. 🔲 Create API routes for Phase 2 features
5. 🔲 Build frontend components using Next.js 14
6. 🔲 Integrate with Mautic OAuth for tenant management
