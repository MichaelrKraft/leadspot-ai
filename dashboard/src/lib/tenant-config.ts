/**
 * Tenant Mautic URL configuration.
 * Returns the Mautic base URL for the current tenant.
 * Falls back to MAUTIC_URL env var for single-tenant deployments.
 */

import { prisma } from '@/lib/prisma';

export async function getTenantMauticUrl(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { mauticUrl: true },
  });

  return tenant?.mauticUrl ?? process.env.MAUTIC_URL ?? '';
}

/**
 * Build a Mautic admin URL path.
 * mauticBase: the base URL from getTenantMauticUrl()
 * path: e.g. '/s/contacts/view/123'
 */
export function buildMauticUrl(mauticBase: string, path: string): string {
  const base = mauticBase.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
