/**
 * Server-side Mautic client factory.
 * Returns a per-request client for the specified tenant.
 * Replaces the old module-level singleton (cross-tenant state bug).
 */

import { MauticClient } from './mautic-client';
import { getMauticTokens } from './mautic-token-db';
import { prisma } from '@/lib/prisma';

export async function getMauticClientForTenant(tenantId: string): Promise<MauticClient> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { mauticUrl: true, id: true },
  });

  const clientId = process.env.MAUTIC_CLIENT_ID;
  const clientSecret = process.env.MAUTIC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing MAUTIC_CLIENT_ID or MAUTIC_CLIENT_SECRET environment variables');
  }

  const storedTokens = await getMauticTokens(tenantId);

  const client = new MauticClient({
    baseUrl: tenant.mauticUrl,
    clientId,
    clientSecret,
  });

  if (storedTokens) {
    client.setTokens({
      accessToken: storedTokens.accessToken,
      refreshToken: storedTokens.refreshToken,
      expiresAt: storedTokens.expiresAt,
    });
  }

  return client;
}

/**
 * Persist refreshed tokens back to the database after an API call.
 * Call this after any Mautic API operation that may have refreshed the token.
 */
export async function persistRefreshedTokens(
  tenantId: string,
  client: MauticClient
): Promise<void> {
  const tokens = client.getTokens();
  if (!tokens) {
    return;
  }

  const { setMauticTokens } = await import('./mautic-token-db');
  await setMauticTokens(tenantId, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });
}

/**
 * Get Mautic config for client-side OAuth redirect (unchanged).
 */
export function getMauticConfig() {
  return {
    baseUrl: process.env.MAUTIC_URL || '',
    clientId: process.env.MAUTIC_CLIENT_ID || '',
  };
}
