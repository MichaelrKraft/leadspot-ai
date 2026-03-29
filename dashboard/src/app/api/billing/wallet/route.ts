import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getTenantPrisma } from '@/lib/prisma-tenant';
import { checkBalanceAndReactivateIfNeeded } from '@/lib/billing/balance-check';

// GET /api/billing/wallet - Get or create wallet for current user
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, tenantId } = session.user;

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account' }, { status: 403 });
  }

  const db = getTenantPrisma(tenantId);

  try {
    // findUnique on Wallet uses the { userId } unique constraint.
    // The extension does not inject tenantId into findUnique, so we use
    // findFirst here to ensure tenant scoping.
    let wallet = await db.wallet.findFirst({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!wallet) {
      // Create wallet with welcome bonus
      wallet = await db.wallet.create({
        data: {
          userId,
          tenantId,
          balance: 5.00, // $5 welcome credit
          lowBalanceAt: 5.00,
          transactions: {
            create: {
              type: 'bonus',
              amount: 5.00,
              balanceAfter: 5.00,
              description: 'Welcome credit - Start making calls!',
              tenantId,
            },
          },
        },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    }

    // Calculate usage stats for current month (tenantId injected by extension)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await db.voiceUsage.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        minutes: true,
        totalCost: true,
      },
    });

    return NextResponse.json({
      ...wallet,
      monthlyMinutes: monthlyUsage._sum.minutes || 0,
      monthlyCost: monthlyUsage._sum.totalCost || 0,
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

// POST /api/billing/wallet - Add credits to wallet (admin use via Stripe webhook)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, tenantId } = session.user;

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account' }, { status: 403 });
  }

  const db = getTenantPrisma(tenantId);

  try {
    const body = await request.json();
    const { amount, type = 'top_up', description } = body;

    if (!amount) {
      return NextResponse.json(
        { error: 'amount is required' },
        { status: 400 }
      );
    }

    // Use findFirst (not findUnique) so the tenant scope from the extension applies
    let wallet = await db.wallet.findFirst({
      where: { userId },
    });

    if (!wallet) {
      // Create wallet
      wallet = await db.wallet.create({
        data: { userId, tenantId, balance: 0 },
      });
    }

    const newBalance = Number(wallet.balance) + amount;

    // Update wallet and create transaction (tenantId injected on update by extension)
    const updatedWallet = await db.wallet.update({
      where: { userId },
      data: {
        balance: newBalance,
        transactions: {
          create: {
            type,
            amount,
            balanceAfter: newBalance,
            description: description || `Added ${amount.toFixed(2)} to wallet`,
            tenantId,
          },
        },
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    // Reactivate any agents that were paused due to zero balance
    await checkBalanceAndReactivateIfNeeded(userId);

    return NextResponse.json(updatedWallet);
  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
}
