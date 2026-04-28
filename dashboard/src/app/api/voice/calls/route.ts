/**
 * Voice Calls API
 *
 * GET /api/voice/calls - List voice calls with pagination
 * POST /api/voice/calls - Initiate a new outbound call
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SipClient, RoomServiceClient } from 'livekit-server-sdk';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/voice/phone';

// ---------------------------------------------------------------------------
// Rate limiter — 10 outbound calls per minute per tenant
// Instantiated once at module level so state persists across requests within
// the same serverless function instance.
// ---------------------------------------------------------------------------
const outboundLimiter = new RateLimiterMemory({ points: 10, duration: 60 });

// ---------------------------------------------------------------------------
// LiveKit client helpers — constructed lazily so missing env vars produce a
// clear error at call time rather than at module load.
// ---------------------------------------------------------------------------
function createRoomServiceClient(): RoomServiceClient {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;

  if (!url || !key || !secret) {
    throw new Error('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set.');
  }

  return new RoomServiceClient(url, key, secret);
}

function createSipClient(): SipClient {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;

  if (!url || !key || !secret) {
    throw new Error('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set.');
  }

  return new SipClient(url, key, secret);
}

// ---------------------------------------------------------------------------
// GET /api/voice/calls
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: userId, tenantId } = session.user;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');

    // Build where clause — scope to the authenticated user's tenant
    const where: Record<string, unknown> = { userId, tenantId };
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    // Get total count
    const total = await prisma.voiceCall.count({ where });

    // Get paginated calls
    const calls = await prisma.voiceCall.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        agent: {
          select: { id: true, name: true, type: true },
        },
        transcript: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      calls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching voice calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice calls' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/voice/calls
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tenantId } = session.user;

  try {
    const body = await request.json() as {
      agentId?: string;
      phoneNumber?: string;
      contactId?: string;
    };

    // Validate required fields
    if (!body.agentId || !body.phoneNumber) {
      return NextResponse.json(
        { error: 'agentId and phoneNumber are required' },
        { status: 400 }
      );
    }

    // Normalize phone number to E.164 before any further processing
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(body.phoneNumber);
    } catch (phoneError) {
      return NextResponse.json(
        {
          error:
            phoneError instanceof Error
              ? phoneError.message
              : 'Invalid phone number format.',
        },
        { status: 400 }
      );
    }

    // Rate-limit check — 10 outbound calls per minute per tenant
    const rateLimitKey = `outbound:${tenantId ?? 'unknown'}`;
    try {
      await outboundLimiter.consume(rateLimitKey);
    } catch (limiterError) {
      if (limiterError instanceof RateLimiterRes) {
        const retryAfterSeconds = Math.ceil(limiterError.msBeforeNext / 1000);
        return NextResponse.json(
          { error: 'Too many outbound calls. Please wait before retrying.' },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfterSeconds) },
          }
        );
      }
      // Unexpected limiter error — surface it
      throw limiterError;
    }

    // Verify agent exists and belongs to this tenant
    const agent = await prisma.voiceAgent.findUnique({
      where: { id: body.agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Create call record — roomId will be updated once the LiveKit room exists
    const call = await prisma.voiceCall.create({
      data: {
        roomId: '',          // placeholder; updated below
        direction: 'outbound',
        status: 'in_progress',
        phoneNumber: normalizedPhone,
        startedAt: new Date(),
        agentId: body.agentId,
        tenantId: tenantId ?? '',
        contactId: body.contactId ?? null,
      },
      include: {
        agent: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // -----------------------------------------------------------------------
    // LiveKit: create room, dispatch agent, then dial out via SIP
    // -----------------------------------------------------------------------
    const roomName = `call-outbound-${call.id}`;

    try {
      const outboundTrunkId = process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID;
      if (!outboundTrunkId) {
        throw new Error('LIVEKIT_SIP_OUTBOUND_TRUNK_ID is not configured.');
      }

      const roomService = createRoomServiceClient();
      const sipClient = createSipClient();

      // Create the LiveKit room with agent dispatch metadata embedded.
      // The Python worker reads this metadata to configure the session.
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 300,    // tear down room after 5 min of silence
        departureTimeout: 30,
        metadata: JSON.stringify({
          agentId: body.agentId,
          callId: call.id,
          tenantId: tenantId ?? '',
          direction: 'outbound',
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agents: [{ agentName: 'leadspot-voice-agent' } as any],
      });

      // Dial the destination number via the outbound SIP trunk.
      // waitUntilAnswered: true means this call returns only once the callee
      // picks up (or the request times out), giving us a clean "answered" state.
      await sipClient.createSipParticipant(
        outboundTrunkId,
        normalizedPhone,
        roomName,
        {
          participantIdentity: `caller-${normalizedPhone}`,
          participantName: 'LeadSpot Agent',
          participantMetadata: JSON.stringify({ callId: call.id }),
          waitUntilAnswered: true,
          playDialtone: true,
          ringingTimeout: 45,         // ring for up to 45 seconds
          maxCallDuration: 3600,      // cap at 1 hour
        },
      );

      // Persist the confirmed room name on the call record
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { roomId: roomName },
      });
    } catch (livekitErr) {
      // Mark the call as failed so the UI reflects reality
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { status: 'failed', endedAt: new Date() },
      }).catch((dbErr: unknown) => {
        console.error('Failed to mark call as failed after LiveKit error:', dbErr);
      });

      const message =
        livekitErr instanceof Error ? livekitErr.message : 'Unknown LiveKit error';

      console.error('LiveKit outbound call failed:', {
        callId: call.id,
        roomName,
        normalizedPhone,
        error: message,
      });

      return NextResponse.json(
        { error: `Failed to initiate outbound call: ${message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        call: { ...call, roomId: roomName },
        roomName,
        livekitUrl: process.env.LIVEKIT_URL,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error initiating call:', error);
    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
