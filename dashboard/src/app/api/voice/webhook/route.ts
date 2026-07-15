/**
 * LiveKit Webhook Handler
 *
 * POST /api/voice/webhook - Receive and process LiveKit room events
 *
 * Events handled:
 * - room_started: Create call record
 * - room_finished: Update call status and duration
 * - participant_joined: Log for analytics
 * - track_published: Handle audio tracks
 *
 * Authorization parameter properly handles null-to-undefined conversion
 * for LiveKit SDK compatibility (Web API returns null, SDK expects undefined)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhook } from '@/lib/livekit-client';
import { checkBalanceAndPauseIfNeeded } from '@/lib/billing/balance-check';
import { sendWalletLowBalance } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const authorization = request.headers.get('authorization') ?? undefined;

    // Verify webhook signature
    let event;
    try {
      event = await verifyWebhook(body, authorization);
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    console.log(`[LiveKit Webhook] Event: ${event.event}`, {
      roomName: event.room?.name,
      roomSid: event.room?.sid,
    });

    switch (event.event) {
      case 'room_started':
        await handleRoomStarted(event);
        break;

      case 'room_finished':
        await handleRoomFinished(event);
        break;

      case 'participant_joined':
        await handleParticipantJoined(event);
        break;

      case 'participant_left':
        await handleParticipantLeft(event);
        break;

      case 'track_published':
        // Could be used for real-time transcription
        break;

      default:
        console.log(`[LiveKit Webhook] Unhandled event: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleRoomStarted(event: any) {
  const room = event.room;
  if (!room?.sid) return;

  // Check if call already exists (might be created by outbound call API)
  const existingCall = await prisma.voiceCall.findUnique({
    where: { roomId: room.sid },
  });

  if (existingCall) {
    console.log(`[LiveKit] Room started for existing call: ${existingCall.id}`);
    return;
  }

  // Parse room metadata for inbound calls
  let metadata: any = {};
  try {
    if (room.metadata) {
      metadata = JSON.parse(room.metadata);
    }
  } catch (e) {
    console.warn('Failed to parse room metadata');
  }

  // For inbound calls, we need an agentId from metadata
  if (!metadata.agentId) {
    console.warn('[LiveKit] No agentId in room metadata for inbound call');
    return;
  }

  // Look up agent to get tenantId
  const agent = await prisma.voiceAgent.findUnique({
    where: { id: metadata.agentId },
    select: { tenantId: true },
  });

  await prisma.voiceCall.create({
    data: {
      roomId: room.sid,
      direction: metadata.direction || 'inbound',
      status: 'in_progress',
      phoneNumber: metadata.phoneNumber || 'unknown',
      startedAt: new Date(room.creationTime || Date.now()),
      agentId: metadata.agentId,
      tenantId: agent?.tenantId ?? '',
    },
  });

  console.log(`[LiveKit] Created call record for room: ${room.sid}`);
}

async function handleRoomFinished(event: any) {
  const room = event.room;
  if (!room?.sid) return;

  // Use base prisma client for the initial lookup — tenantId not yet known
  const call = await prisma.voiceCall.findUnique({
    where: { roomId: room.sid },
    include: {
      agent: {
        select: { userId: true, tenantId: true },
      },
    },
  });

  if (!call) {
    console.warn(`[LiveKit] No call found for room: ${room.sid}`);
    return;
  }

  // Calculate duration using LiveKit event timestamp (not Date.now() which can drift)
  const startTime = new Date(call.startedAt).getTime();
  const endTime = new Date(event.createdAt ?? Date.now()).getTime();
  const duration = Math.floor((endTime - startTime) / 1000);

  // Update call record using base prisma — tenantId for the write comes from call.tenantId
  await prisma.voiceCall.update({
    where: { roomId: room.sid },
    data: {
      status: 'completed',
      duration,
      endedAt: new Date(event.createdAt ?? Date.now()),
    },
  });

  console.log(`[LiveKit] Call completed: ${call.id}, duration: ${duration}s`);

  // Record usage and deduct from wallet if we have a userId and tenantId
  const tenantId = call.agent?.tenantId ?? call.tenantId;
  if (call.agent?.userId && tenantId && duration > 0) {
    await recordUsageAndDeduct(call.agent.userId, tenantId, call.id, duration);
  }
}

// Record voice usage and deduct from wallet.
// tenantId is passed in (derived from the VoiceAgent record) and written
// explicitly to every record.  We use the base prisma client inside the
// $transaction because Prisma's $extends interceptors do not propagate
// into interactive transaction callbacks; tenantId is injected manually.
//
// Hold-release flow (for calls pre-authorized via /api/voice/calls/from-sip):
//   1. Find the 'hold' BillingTransaction created at call start.
//   2. Compute actualCost = minutes * COST_PER_MINUTE.
//   3. Compute refund = holdAmount - actualCost (clamped to 0 if negative).
//   4. Credit refund back to wallet + create a 'refund' transaction.
//   5. Create a 'usage_deduction' transaction for the actual cost.
//
// Legacy flow (calls without a hold, e.g. outbound calls or pre-feature):
//   Falls back to the original direct deduction logic.
async function recordUsageAndDeduct(
  userId: string,
  tenantId: string,
  callId: string,
  durationSeconds: number,
) {
  const COST_PER_MINUTE = 0.10;
  const BASE_COST_PER_MINUTE = 0.04;

  try {
    // Check if usage already recorded (idempotency guard)
    const existingUsage = await prisma.voiceUsage.findUnique({
      where: { callId },
    });

    if (existingUsage) {
      console.log(`[Billing] Usage already recorded for call: ${callId}`);
      return;
    }

    // Calculate costs
    const minutes = durationSeconds / 60;
    const totalCost = minutes * COST_PER_MINUTE;
    const baseCost = minutes * BASE_COST_PER_MINUTE;
    const margin = totalCost - baseCost;

    // Look up the hold transaction created by the from-sip endpoint (if any)
    const holdTransaction = await prisma.billingTransaction.findFirst({
      where: {
        type: 'hold',
        description: `Call hold: ${callId}`,
      },
      select: { id: true, walletId: true, amount: true },
    });

    if (holdTransaction) {
      // Hold-release path: reconcile the pre-authorized hold against actual cost
      const holdAmount = Math.abs(Number(holdTransaction.amount)); // hold was stored as negative
      const refundAmount = Math.max(0, holdAmount - totalCost);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.$transaction(async (tx: any) => {
        // Re-read wallet inside the transaction for accurate snapshot
        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { id: true, balance: true, lowBalanceAt: true },
        });

        if (!wallet) {
          console.warn(`[Billing] No wallet found for user: ${userId}`);
          await tx.voiceUsage.create({
            data: { userId, tenantId, callId, minutes, costRate: COST_PER_MINUTE, totalCost, baseCost, margin },
          });
          return;
        }

        const currentBalance = Number(wallet.balance);

        // Credit back any unused portion of the hold
        let balanceAfterRefund = currentBalance;
        if (refundAmount > 0) {
          const updatedWallet = await tx.wallet.update({
            where: { userId },
            data: { balance: { increment: refundAmount } },
            select: { balance: true },
          });
          balanceAfterRefund = Number(updatedWallet.balance);

          await tx.billingTransaction.create({
            data: {
              walletId: wallet.id,
              tenantId,
              type: 'refund',
              amount: refundAmount,
              balanceAfter: balanceAfterRefund,
              description: `Hold refund: ${callId} (unused ${refundAmount.toFixed(4)} of ${holdAmount.toFixed(4)} hold)`,
              callId,
            },
          });
        }

        // Record the actual usage deduction.
        // The hold already removed the funds; balanceAfter reflects the post-refund
        // balance minus the actual cost (the remainder that was already deducted).
        const balanceAfterUsage = balanceAfterRefund - (holdAmount - refundAmount);
        await tx.billingTransaction.create({
          data: {
            walletId: wallet.id,
            tenantId,
            type: 'usage_deduction',
            amount: -totalCost,
            balanceAfter: balanceAfterUsage,
            description: `Voice call: ${minutes.toFixed(1)} minutes`,
            callId,
          },
        });

        await tx.voiceUsage.create({
          data: { userId, tenantId, callId, minutes, costRate: COST_PER_MINUTE, totalCost, baseCost, margin },
        });

        if (balanceAfterRefund < Number(wallet.lowBalanceAt)) {
          console.warn(`[Billing] Low balance alert for user ${userId}: ${balanceAfterRefund.toFixed(2)}`);
        }
      }, { isolationLevel: 'Serializable' });

      console.log(
        `[Billing] Hold released for call ${callId}: ` +
        `held=${holdAmount.toFixed(4)}, actual=${totalCost.toFixed(4)}, refund=${refundAmount.toFixed(4)}`
      );
    } else {
      // Legacy path: no hold was created — deduct directly from wallet balance
      // (handles outbound calls and calls placed before the from-sip endpoint existed)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.$transaction(async (tx: any) => {
        // Re-read wallet inside the transaction for accurate balance
        const wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (!wallet) {
          console.warn(`[Billing] No wallet found for user: ${userId}`);
          await tx.voiceUsage.create({
            data: { userId, tenantId, callId, minutes, costRate: COST_PER_MINUTE, totalCost, baseCost, margin },
          });
          return;
        }

        // Allow the balance to go negative so overage (minutes used past zero
        // before the mid-call kill switch fired) is recorded as real debt
        // rather than silently written off by clamping at zero.
        const numBalance = Number(wallet.balance);
        const newBalance = numBalance - totalCost;

        await tx.voiceUsage.create({
          data: { userId, tenantId, callId, minutes, costRate: COST_PER_MINUTE, totalCost, baseCost, margin },
        });

        await tx.wallet.update({
          where: { userId },
          data: {
            balance: newBalance,
            transactions: {
              create: {
                type: 'usage_deduction',
                tenantId,
                amount: -totalCost,
                balanceAfter: newBalance,
                description: `Voice call: ${minutes.toFixed(1)} minutes`,
                callId,
              },
            },
          },
        });

        if (newBalance < Number(wallet.lowBalanceAt)) {
          console.warn(`[Billing] Low balance alert for user ${userId}: ${newBalance.toFixed(2)}`);
        }
      }, { isolationLevel: 'Serializable' });

      console.log(`[Billing] Recorded usage for call ${callId}: ${minutes.toFixed(2)} mins, ${totalCost.toFixed(4)} charged`);
    }

    // Auto-pause agents if balance is depleted
    await checkBalanceAndPauseIfNeeded(userId);

    // Send low balance email if wallet is below threshold
    const currentWallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true, lowBalanceAt: true },
    });
    if (currentWallet && Number(currentWallet.balance) < Number(currentWallet.lowBalanceAt)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) {
        await sendWalletLowBalance(user.email, Number(currentWallet.balance)).catch((err) => {
          console.error('[Billing] Failed to send low balance email:', err);
        });
      }
    }
  } catch (error) {
    console.error(`[Billing] Error recording usage for call ${callId}:`, error);
  }
}

async function handleParticipantJoined(event: any) {
  const participant = event.participant;
  const room = event.room;

  console.log(`[LiveKit] Participant joined: ${participant?.identity} in room ${room?.name}`);
  
  // Could track participant details for analytics
}

async function handleParticipantLeft(event: any) {
  const participant = event.participant;
  const room = event.room;

  console.log(`[LiveKit] Participant left: ${participant?.identity} from room ${room?.name}`);
  
  // Check if this was the last participant (call might end)
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'LiveKit webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
