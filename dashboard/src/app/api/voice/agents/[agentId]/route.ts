/**
 * Individual Voice Agent API
 *
 * GET /api/voice/agents/[agentId] - Get single agent by ID
 * PATCH /api/voice/agents/[agentId] - Update agent
 * DELETE /api/voice/agents/[agentId] - Delete agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { agentId } = await context.params;

    const agent = await prisma.voiceAgent.findUnique({
      where: { id: agentId },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error fetching voice agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice agent' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { agentId } = await context.params;
    const body = await request.json();

    // Check if agent exists
    const existing = await prisma.voiceAgent.findUnique({
      where: { id: agentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Build update data (only include fields that are provided)
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.voiceId !== undefined) updateData.voiceId = body.voiceId;

    // Handle config updates (merge with existing config)
    if (body.config !== undefined || body.welcomeMessage !== undefined ||
        body.allowInterruption !== undefined || body.customVariables !== undefined ||
        body.httpTools !== undefined || body.mcpServers !== undefined) {

      const existingConfig = (existing.config as any) || {};
      updateData.config = {
        ...existingConfig,
        ...(body.config || {}),
        ...(body.welcomeMessage !== undefined && { welcomeMessage: body.welcomeMessage }),
        ...(body.allowInterruption !== undefined && { allowInterruption: body.allowInterruption }),
        ...(body.customVariables !== undefined && { customVariables: body.customVariables }),
        ...(body.httpTools !== undefined && { httpTools: body.httpTools }),
        ...(body.mcpServers !== undefined && { mcpServers: body.mcpServers }),
      };
    }

    const agent = await prisma.voiceAgent.update({
      where: { id: agentId },
      data: updateData,
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error updating voice agent:', error);
    return NextResponse.json(
      { error: 'Failed to update voice agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { agentId } = await context.params;

    // Check if agent exists
    const existing = await prisma.voiceAgent.findUnique({
      where: { id: agentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Delete the agent (cascades to calls, transcripts, usage)
    await prisma.voiceAgent.delete({
      where: { id: agentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting voice agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete voice agent' },
      { status: 500 }
    );
  }
}
