import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/billing/balance-check
 * Used by voice agents to check if a call should continue based on wallet balance.
 * Called periodically during active calls. Requires the voice-agent API key.
 */
export async function GET(request: NextRequest) {
  const expectedKey = process.env.VOICE_AGENT_API_KEY;
  const providedKey = request.headers.get('x-api-key');
  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get('tenantId');
  const callId = request.nextUrl.searchParams.get('callId');

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenantId is required' },
      { status: 400 }
    );
  }

  try {
    // Find wallet for this tenant via a tenant member
    const tenantMember = await prisma.tenantMember.findFirst({
      where: { tenantId, role: 'owner' },
      select: { userId: true },
    });

    if (!tenantMember) {
      // No owner / wallet resolvable — fail closed (don't grant free minutes).
      return NextResponse.json({ shouldContinue: false, remainingBalance: 0 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: tenantMember.userId },
      select: { balance: true },
    });

    const balance = Number(wallet?.balance ?? 0);
    const shouldContinue = balance > 0;

    return NextResponse.json({
      shouldContinue,
      remainingBalance: balance,
    });
  } catch (error) {
    console.error('[BalanceCheck] Error:', error);
    // Fail open — allow call to continue on error to avoid interrupting live calls
    return NextResponse.json({ shouldContinue: true, remainingBalance: 0 });
  }
}
