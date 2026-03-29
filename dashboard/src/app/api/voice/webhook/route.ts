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

    // Atomic wallet deduction — Serializable isolation prevents race conditions
    // when multiple concurrent webhooks fire for the same user.
    await prisma.$transaction(async (tx) => {
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

      const numBalance = Number(wallet.balance);
      const newBalance = Math.max(0, numBalance - totalCost);

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

    console.log(`[Billing] Recorded usage for call ${callId}: ${minutes.toFixed(2)} mins, ${totalCost.toFixed(2)} charged`);

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
