/**
 * Task Detail API
 *
 * PATCH /api/tasks/[taskId] - Mark a task as complete (tenant-scoped)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { taskId: string } }
) {
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

  const { taskId } = params;

  // Verify the task belongs to this tenant before updating
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { tenantId: true, completedAt: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (existing.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { completedAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[tasks] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
