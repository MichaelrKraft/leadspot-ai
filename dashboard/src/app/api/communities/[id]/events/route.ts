import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/communities/[id]/events
 * List events for a community with optional filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status'); // upcoming, past, all

    interface EventWhereClause {
      communityId: string;
      startTime?: {
        gte?: Date;
        lte?: Date;
      };
    }

    const where: EventWhereClause = {
      communityId: params.id,
    };

    // Filter by date range if provided
    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (status === 'upcoming') {
      where.startTime = {
        gte: new Date(),
      };
    } else if (status === 'past') {
      where.startTime = {
        lte: new Date(),
      };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
    });

    return NextResponse.json({
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('[GET /api/communities/[id]/events]', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/communities/[id]/events
 * Create a new event (admin/moderator only)
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

    // Check if user is admin/moderator
    const membership = await prisma.communityMember.findFirst({
      where: {
        communityId: params.id,
        userId,
        role: {
          in: ['moderator', 'admin', 'owner'],
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only moderators can create events' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, startTime, endTime, meetingUrl, maxAttendees } = body;

    if (!title || !startTime) {
      return NextResponse.json(
        { error: 'Title and start time are required' },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        communityId: params.id,
        hostId: userId,
        title,
        description: description || null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        meetingUrl: meetingUrl || null,
        maxAttendees: maxAttendees || null,
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('[POST /api/communities/[id]/events]', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
