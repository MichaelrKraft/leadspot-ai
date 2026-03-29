import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/attendees
 * Get list of attendees for an event
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const attendees = await prisma.eventAttendee.findMany({
      where: {
        eventId: params.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'asc',
      },
    });

    return NextResponse.json({
      attendees,
      count: attendees.length,
    });
  } catch (error) {
    console.error('[GET /api/events/[id]/attendees]', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendees' },
      { status: 500 }
    );
  }
}
