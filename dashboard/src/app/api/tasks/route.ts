/**
 * Tasks API
 *
 * GET /api/tasks          - List tasks for authenticated tenant, ordered by dueAt ASC
 * GET /api/tasks?type=X   - Filter by type ('followup', 'call', 'email')
 * POST /api/tasks         - Create a new task manually
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

  const { tenantId } = session.user;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'No tenant associated with this account' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type');

  try {
    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      orderBy: { dueAt: 'asc' },
    });

    // Fetch associated VoiceCall records for tasks that reference a call
    const callIds = tasks
      .map((t) => t.callId)
      .filter((id): id is string => id !== null);

    const callsById = new Map(
      callIds.length > 0
        ? (
            await prisma.voiceCall.findMany({
              where: { id: { in: callIds }, tenantId },
              select: { id: true, summary: true, phoneNumber: true, direction: true },
            })
          ).map((c) => [c.id, c])
        : []
    );

    const result = tasks.map((task) => ({
      ...task,
      voiceCall: task.callId ? (callsById.get(task.callId) ?? null) : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[tasks] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = session.user;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'No tenant associated with this account' },
      { status: 403 }
    );
  }

  let body: {
    contactId: string;
    type: string;
    notes?: string;
    dueAt: string;
    callId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.contactId || !body.type || !body.dueAt) {
    return NextResponse.json(
      { error: 'contactId, type, and dueAt are required' },
      { status: 400 }
    );
  }

  try {
    // Verify foreign keys belong to this tenant before creating
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, tenantId },
    });
    if (!contact) {
      return NextResponse.json({ error: 'contactId not found' }, { status: 404 });
    }

    if (body.callId) {
      const call = await prisma.voiceCall.findFirst({
        where: { id: body.callId, tenantId },
      });
      if (!call) {
        return NextResponse.json({ error: 'callId not found' }, { status: 404 });
      }
    }

    const task = await prisma.task.create({
      data: {
        contactId: body.contactId,
        tenantId,
        type: body.type,
        notes: body.notes ?? null,
        dueAt: new Date(body.dueAt),
        source: 'manual',
        callId: body.callId ?? null,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[tasks] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
