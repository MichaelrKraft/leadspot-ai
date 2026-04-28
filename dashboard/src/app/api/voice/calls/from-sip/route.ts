/**
 * From-SIP Endpoint
 *
 * POST /api/voice/calls/from-sip
 *   Called by the Python voice agent at the start of every inbound call.
 *   Resolves agent ownership from the dialed phone number, pre-authorizes a
 *   balance hold, creates the VoiceCall record, and returns agent config so
 *   the voice agent can start the session without an extra round-trip.
 *
 * Authentication: machine-to-machine via x-api-key: VOICE_AGENT_API_KEY
 *   (same pattern as /api/voice/calls/[callId]/finalize)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MAX_HOLD_AMOUNT = 5.00;       // Maximum dollars held per call
const MIN_BALANCE_REQUIRED = 0.10;  // Reject calls below this balance

interface FromSipBody {
  twilioCallSid: string;
  agentPhoneNumber: string; // The Twilio number that was called (To)
  callerPhone: string;       // The caller's number (From)
  direction: 'inbound' | 'outbound';
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * Strips all non-digit characters and prepends +1 when the result is 10 digits.
 * Already-formatted E.164 strings (+1XXXXXXXXXX) pass through unchanged.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  // Preserve the original if it doesn't match known US patterns
  return raw.startsWith('+') ? raw : `+${digits}`;
}

export async function POST(request: NextRequest) {
  // 1. Authenticate — internal API key from voice agent
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.VOICE_AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse and validate request body
  let body: FromSipBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { twilioCallSid, agentPhoneNumber, callerPhone, direction } = body;

  if (!twilioCallSid || !agentPhoneNumber || !callerPhone) {
    return NextResponse.json(
      { error: 'twilioCallSid, agentPhoneNumber, and callerPhone are required' },
      { status: 400 }
    );
  }

  // 3. Normalize phone numbers to E.164
  const normalizedAgentPhone = normalizePhone(agentPhoneNumber);
  const normalizedCallerPhone = normalizePhone(callerPhone);

  // 4. Resolve the VoiceAgent by its phone number
  const agent = await prisma.voiceAgent.findFirst({
    where: {
      phoneNumber: normalizedAgentPhone,
      status: 'active',
    },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      config: true,
    },
  });

  if (!agent) {
    console.warn('[from-sip] No active agent found for phone number:', normalizedAgentPhone);
    return NextResponse.json(
      { error: 'No active agent found for this phone number' },
      { status: 404 }
    );
  }

  // 5. Look up the wallet for the agent owner
  const wallet = await prisma.wallet.findUnique({
    where: { userId: agent.userId },
    select: { id: true, balance: true, tenantId: true },
  });

  if (!wallet) {
    console.warn('[from-sip] No wallet found for userId:', agent.userId);
    return NextResponse.json(
      { error: 'No billing account found for agent owner' },
      { status: 402 }
    );
  }

  const currentBalance = Number(wallet.balance);

  // 6. Pre-authorize a balance hold — atomic Serializable transaction
  //    This prevents accepting calls when balance is exhausted and ensures
  //    concurrent call starts don't both draw from the same balance.
  const roomId = `call-${twilioCallSid}`;

  let callId: string;
  let holdAmount: number;

  try {
    const result = await prisma.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (tx: any) => {
        // Re-read wallet inside the transaction to get a consistent snapshot
        const freshWallet = await tx.wallet.findUnique({
          where: { userId: agent.userId },
          select: { id: true, balance: true },
        });

        if (!freshWallet) {
          throw new Error('WALLET_GONE');
        }

        const balance = Number(freshWallet.balance);

        if (balance < MIN_BALANCE_REQUIRED) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        // Hold the lesser of the full balance or MAX_HOLD_AMOUNT
        const hold = Math.min(balance, MAX_HOLD_AMOUNT);

        // Deduct the hold from the wallet immediately
        const updatedWallet = await tx.wallet.update({
          where: { userId: agent.userId },
          data: { balance: { decrement: hold } },
          select: { balance: true },
        });

        const balanceAfterHold = Number(updatedWallet.balance);

        // Create the VoiceCall record
        const call = await tx.voiceCall.create({
          data: {
            roomId,
            direction: direction ?? 'inbound',
            status: 'in_progress',
            phoneNumber: normalizedCallerPhone,
            agentId: agent.id,
            tenantId: agent.tenantId,
            startedAt: new Date(),
          },
          select: { id: true },
        });

        // Record the hold as a BillingTransaction so it can be reconciled later
        await tx.billingTransaction.create({
          data: {
            walletId: freshWallet.id,
            tenantId: agent.tenantId,
            type: 'hold',
            amount: -hold,
            balanceAfter: balanceAfterHold,
            description: `Call hold: ${call.id}`,
            callId: call.id,
          },
        });

        return { callId: call.id, holdAmount: hold };
      },
      { isolationLevel: 'Serializable' }
    );

    callId = result.callId;
    holdAmount = result.holdAmount;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json(
          { error: 'INSUFFICIENT_BALANCE' },
          { status: 402 }
        );
      }
      if (error.message === 'WALLET_GONE') {
        return NextResponse.json(
          { error: 'Billing account not found' },
          { status: 402 }
        );
      }
    }
    console.error('[from-sip] Transaction failed:', error);
    return NextResponse.json(
      { error: 'Failed to pre-authorize call' },
      { status: 500 }
    );
  }

  console.log('[from-sip] Call pre-authorized:', {
    callId,
    agentId: agent.id,
    tenantId: agent.tenantId,
    holdAmount: holdAmount.toFixed(2),
    callerPhone: normalizedCallerPhone,
  });

  // 7. Return agent config for the voice agent to start the session
  return NextResponse.json({
    callId,
    agentId: agent.id,
    tenantId: agent.tenantId,
    agentConfig: agent.config,
    holdAmount,
  });
}
