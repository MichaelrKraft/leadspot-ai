import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getCircuitStatus } from '@/lib/mautic-circuit-breaker';

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = getCircuitStatus(session.user.tenantId);
  return NextResponse.json({
    tenantSlug: params.slug,
    mauticCircuit: status.open ? 'open' : 'closed',
    failures: status.failures,
  });
}
