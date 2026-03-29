import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/billing/balance-check
 * Used by voice agents to check if a call should continue based on wallet balance.
 * Called every 60 seconds during active calls.
 */
export async function GET(request: NextRequest) {
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
      // No owner found — allow call to continue (fail open)
      return NextResponse.json({ shouldContinue: true, remainingBalance: 0 });
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
