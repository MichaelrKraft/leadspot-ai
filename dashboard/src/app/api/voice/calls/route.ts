/**
 * Voice Calls API
 *
 * GET /api/voice/calls - List voice calls with pagination
 * POST /api/voice/calls - Initiate a new outbound call
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const where: any = { userId, tenantId };
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

export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: userId, tenantId } = session.user;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.agentId || !body.phoneNumber) {
      return NextResponse.json(
        { error: 'agentId and phoneNumber are required' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.voiceAgent.findUnique({
      where: { id: body.agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Generate unique room ID for LiveKit
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create call record (VoiceCall has no userId field — scoped via agent)
    const call = await prisma.voiceCall.create({
      data: {
        roomId,
        direction: 'outbound',
        status: 'in_progress',
        phoneNumber: body.phoneNumber,
        startedAt: new Date(),
        agentId: body.agentId,
        tenantId: tenantId ?? '',
        contactId: body.contactId || null,
      },
      include: {
        agent: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // TODO: Integrate with LiveKit to actually initiate the call
    // For now, return the call record with LiveKit connection info placeholder

    return NextResponse.json({
      call,
      roomName: roomId,
      agentToken: 'TODO: Generate LiveKit agent token',
      livekitUrl: process.env.LIVEKIT_URL || 'wss://demo.livekit.cloud',
      message: 'Call record created. LiveKit integration pending.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error initiating call:', error);
    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
