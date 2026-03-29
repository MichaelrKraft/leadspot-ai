/**
 * Mautic Contacts API Route
 *
 * GET /api/mautic/contacts - List contacts
 * POST /api/mautic/contacts - Create contact
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
      start: searchParams.get('start') ? parseInt(searchParams.get('start')!) : 0,
      orderBy: searchParams.get('orderBy') || undefined,
      orderByDir: (searchParams.get('orderByDir') as 'asc' | 'desc') || undefined,
    };

    const result = await client.getContacts(params);
    await persistRefreshedTokens(tenantId, client);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const fields = await request.json();
    const contact = await client.createContact(fields);
    await persistRefreshedTokens(tenantId, client);

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Create contact error:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
