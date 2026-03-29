import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getTenantMauticUrl } from '@/lib/tenant-config';

export async function GET() {
  const session = await getServerSession(authConfig);

  if (!session?.user?.tenantId) {
    // Fall back to env var for unauthenticated or single-tenant
    return NextResponse.json({
      mauticUrl: process.env.MAUTIC_URL ?? '',
    });
  }

  const mauticUrl = await getTenantMauticUrl(session.user.tenantId);
  return NextResponse.json({ mauticUrl });
}
