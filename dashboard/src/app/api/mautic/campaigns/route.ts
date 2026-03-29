/**
 * Mautic Campaigns API Route
 *
 * GET /api/mautic/campaigns - List campaigns
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getMauticClientForTenant, persistRefreshedTokens } from '@/lib/mautic-server';

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const params = {
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 30,
      published: searchParams.get('published') === 'true' ? true :
                 searchParams.get('published') === 'false' ? false : undefined,
    };

    const result = await client.getCampaigns(params);
    await persistRefreshedTokens(tenantId, client);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
