import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/registration-status
 * Check if current user is registered for an event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { isRegistered: false },
        { status: 200 }
      );
    }

    const attendee = await prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId,
        },
      },
    });

    return NextResponse.json({
      isRegistered: !!attendee,
    });
  } catch (error) {
    console.error('[GET /api/events/[id]/registration-status]', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}
