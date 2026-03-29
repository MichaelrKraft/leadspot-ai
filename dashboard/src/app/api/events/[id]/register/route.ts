import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/register
 * Register for an event
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            attendees: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if event is full
    if (event.maxAttendees && event._count.attendees >= event.maxAttendees) {
      return NextResponse.json(
        { error: 'Event is full' },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingAttendee = await prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId,
        },
      },
    });

    if (existingAttendee) {
      return NextResponse.json(
        { error: 'Already registered for this event' },
        { status: 400 }
      );
    }

    // Create attendee record
    const attendee = await prisma.eventAttendee.create({
      data: {
        eventId: params.id,
        userId,
        status: 'registered',
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
    });

    // Award 20 points for registering
    await prisma.pointTransaction.create({
      data: {
        userId,
        points: 20,
        reason: 'Event registration',
        sourceType: 'event',
        sourceId: params.id,
      },
    });

    return NextResponse.json(attendee, { status: 201 });
  } catch (error) {
    console.error('[POST /api/events/[id]/register]', error);
    return NextResponse.json(
      { error: 'Failed to register for event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]/register
 * Unregister from an event
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if registered
    const attendee = await prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId,
        },
      },
    });

    if (!attendee) {
      return NextResponse.json(
        { error: 'Not registered for this event' },
        { status: 400 }
      );
    }

    // Delete attendee record
    await prisma.eventAttendee.delete({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId,
        },
      },
    });

    // Deduct 20 points
    await prisma.pointTransaction.create({
      data: {
        userId,
        points: -20,
        reason: 'Event unregistration',
        sourceType: 'event',
        sourceId: params.id,
      },
    });

    return NextResponse.json(
      { message: 'Unregistered successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/events/[id]/register]', error);
    return NextResponse.json(
      { error: 'Failed to unregister from event' },
      { status: 500 }
    );
  }
}
