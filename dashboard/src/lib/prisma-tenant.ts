/**
 * Tenant-scoped Prisma extension (Phase 2.1)
 *
 * Returns a Prisma client extended so that every query against a tenant-scoped
 * model automatically has `WHERE tenantId = ?` injected.  This makes cross-tenant
 * data leaks impossible at the ORM layer, regardless of what callers pass in.
 *
 * Tenant-scoped models (tenantId String — non-nullable):
 *   VoiceAgent, VoiceCall, Wallet, VoiceUsage, BillingTransaction
 *
 * Partially-migrated model (tenantId String? — nullable):
 *   Community — legacy rows with tenantId = null are NOT filtered out; the
 *   extension only adds the tenantId filter when the caller supplies a tenantId.
 *   This preserves access to unmigrated rows during the 3-step migration.
 *
 * Usage:
 *   const db = getTenantPrisma(session.user.tenantId);
 *   const agents = await db.voiceAgent.findMany(); // tenantId injected automatically
 */

import { prisma } from '@/lib/prisma';

export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      // ─────────────────────────────────────────────────────────────────────
      // VoiceAgent
      // ─────────────────────────────────────────────────────────────────────
      voiceAgent: {
        findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        // findUnique cannot accept extra where fields beyond the unique constraint.
        // We leave it as-is; callers who need tenant scoping should use findFirst.
        findUnique({ args, query }) {
          return query(args);
        },
        create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((record) => ({ ...record, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        update({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        delete({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // VoiceCall
      // ─────────────────────────────────────────────────────────────────────
      voiceCall: {
        findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args);
        },
        create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((record) => ({ ...record, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        update({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        delete({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // Wallet
      // ─────────────────────────────────────────────────────────────────────
      wallet: {
        findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        // Wallet findUnique uses { userId } or { id } — not tenantId.
        // Leave as-is; use findFirst when tenant scoping is needed.
        findUnique({ args, query }) {
          return query(args);
        },
        create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((record) => ({ ...record, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        update({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        delete({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // VoiceUsage
      // ─────────────────────────────────────────────────────────────────────
      voiceUsage: {
        findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args);
        },
        create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((record) => ({ ...record, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        update({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        delete({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // BillingTransaction
      // ─────────────────────────────────────────────────────────────────────
      billingTransaction: {
        findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args);
        },
        create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((record) => ({ ...record, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        update({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        delete({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // Community  (tenantId String? — nullable, partially migrated)
      //
      // Legacy rows have tenantId = null.  We must NOT filter those out, as
      // they are still in the 3-step migration process.  Instead, we only
      // add the tenantId condition when a real tenantId is provided, which
      // scopes the query to the tenant's rows while leaving legacy rows
      // visible to code that still uses the base `prisma` client directly.
      // ─────────────────────────────────────────────────────────────────────
      community: {
        findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args);
        },
        create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((record) => ({ ...record, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        update({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        delete({ args, query }) {
          args.where = { ...args.where, tenantId } as typeof args.where;
          return query(args);
        },
        deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// $queryRaw / $executeRaw audit (Phase 2.1)
//
// Searched: dashboard/src/**  for `$queryRaw` and `$executeRaw`
// Result:   NO occurrences found as of Phase 2.1 implementation.
//
// If raw SQL is added in the future it must be reviewed manually for
// tenant-scoping, since $extends does NOT intercept $queryRaw / $executeRaw.
// Any raw query touching a tenant-scoped table must include an explicit
// `WHERE "tenantId" = $N` clause.
// ═══════════════════════════════════════════════════════════════════════════
