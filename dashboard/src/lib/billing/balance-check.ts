import { prisma } from '@/lib/prisma';

// Minimum balance required to make calls (in dollars)
const MINIMUM_BALANCE = 0.10; // At least 1 minute worth

export interface BalanceCheckResult {
  hasBalance: boolean;
  balance: number;
  minimumRequired: number;
  shortfall: number;
}

/**
 * Check if a user has sufficient balance to make voice calls
 */
export async function checkUserBalance(userId: string): Promise<BalanceCheckResult> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  const balance = Number(wallet?.balance ?? 0);
  const hasBalance = balance >= MINIMUM_BALANCE;

  return {
    hasBalance,
    balance,
    minimumRequired: MINIMUM_BALANCE,
    shortfall: hasBalance ? 0 : MINIMUM_BALANCE - balance,
  };
}

/**
 * Pause all active agents for a user when their balance is depleted
 */
export async function pauseAgentsForUser(userId: string): Promise<number> {
  const result = await prisma.voiceAgent.updateMany({
    where: {
      userId,
      status: 'active',
    },
    data: {
      status: 'paused_no_balance',
    },
  });

  if (result.count > 0) {
    console.log(`[Billing] Paused ${result.count} agents for user ${userId} due to zero balance`);
  }

  return result.count;
}

/**
 * Reactivate agents that were paused due to zero balance
 */
export async function reactivateAgentsForUser(userId: string): Promise<number> {
  const result = await prisma.voiceAgent.updateMany({
    where: {
      userId,
      status: 'paused_no_balance',
    },
    data: {
      status: 'active',
    },
  });

  if (result.count > 0) {
    console.log(`[Billing] Reactivated ${result.count} agents for user ${userId} after balance restored`);
  }

  return result.count;
}

/**
 * Check balance and pause agents if needed
 * Called after usage is recorded
 */
export async function checkBalanceAndPauseIfNeeded(userId: string): Promise<void> {
  const { hasBalance, balance } = await checkUserBalance(userId);

  if (!hasBalance) {
    await pauseAgentsForUser(userId);
    console.warn(`[Billing] User ${userId} has insufficient balance ($${balance.toFixed(2)}). Agents paused.`);
  }
}

/**
 * Check balance and reactivate agents if balance was restored
 * Called after wallet top-up
 */
export async function checkBalanceAndReactivateIfNeeded(userId: string): Promise<void> {
  const { hasBalance, balance } = await checkUserBalance(userId);

  if (hasBalance) {
    await reactivateAgentsForUser(userId);
    console.log(`[Billing] User ${userId} balance restored ($${balance.toFixed(2)}). Checking for paused agents.`);
  }
}
