/**
 * Mautic Stats API Route
 *
 * GET /api/mautic/stats - Get dashboard stats
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getMauticClientForTenant, persistRefreshedTokens } from '@/lib/mautic-server';

export async function GET() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: 'Not authenticated. Please connect to Mautic first.' },
      { status: 401 }
    );
  }

  const { tenantId } = session.user;

  try {
    const client = await getMauticClientForTenant(tenantId);
    const stats = await client.getStats();
    await persistRefreshedTokens(tenantId, client);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
