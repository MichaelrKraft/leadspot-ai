/**
 * Voice Agents API
 *
 * GET /api/voice/agents - List all voice agents for the current user
 * POST /api/voice/agents - Create a new voice agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getTenantPrisma } from '@/lib/prisma-tenant';

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
    const agents = await db.voiceAgent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching voice agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice agents' },
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

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account' }, { status: 403 });
  }

  const db = getTenantPrisma(tenantId);

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Build the config object from the request body
    const agentConfig = {
      welcomeMessage: body.welcomeMessage || '',
      allowInterruption: body.allowInterruption ?? true,
      customVariables: body.customVariables || [],
      httpTools: body.httpTools || [],
      mcpServers: body.mcpServers || [],
    };

    // Create agent in database
    const agent = await db.voiceAgent.create({
      data: {
        name: body.name,
        type: body.type,
        status: 'inactive',
        phoneNumber: body.phoneNumber || null,
        systemPrompt: body.systemPrompt || getDefaultPrompt(body.type),
        voiceId: body.voiceId || 'rachel',
        config: agentConfig,
        userId,
        tenantId,
      },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    console.log('Created voice agent:', {
      id: agent.id,
      name: agent.name,
      type: agent.type,
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error creating voice agent:', error);
    return NextResponse.json(
      { error: 'Failed to create voice agent' },
      { status: 500 }
    );
  }
}

function getDefaultPrompt(type: string): string {
  switch (type) {
    case 'lead_qualification':
      return `You are a friendly lead qualification assistant. Your job is to:
1. Greet the caller warmly
2. Collect their name, phone number, and email
3. Ask about their budget, timeline, and specific needs
4. Determine if they're a qualified lead
5. Offer to schedule a follow-up call if qualified

Be professional, concise, and helpful. Always confirm important details.`;

    case 'appointment_booking':
      return `You are a helpful appointment booking assistant. Your job is to:
1. Greet the caller and ask how you can help
2. Collect their name and contact information
3. Understand what type of appointment they need
4. Find a suitable time that works for them
5. Book the appointment and offer to send a text confirmation

Be friendly, efficient, and accommodating with scheduling.`;

    case 'customer_support':
      return `You are a helpful customer support assistant. Your job is to:
1. Greet the caller and ask how you can help
2. Listen to their issue or question
3. Provide helpful information or troubleshooting steps
4. If you can't resolve the issue, offer to escalate to a human
5. Ensure the customer feels heard and supported

Be patient, empathetic, and solution-focused.`;

    default:
      return `You are a helpful voice assistant. Be friendly, professional, and helpful.`;
  }
}
