import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications
 * Get user's notifications with unread count
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get last 20 notifications
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    // Group by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const grouped = {
      today: [] as typeof notifications,
      yesterday: [] as typeof notifications,
      thisWeek: [] as typeof notifications,
      older: [] as typeof notifications,
    };

    notifications.forEach((notif) => {
      const notifDate = new Date(notif.createdAt);
      if (notifDate >= today) {
        grouped.today.push(notif);
      } else if (notifDate >= yesterday) {
        grouped.yesterday.push(notif);
      } else if (notifDate >= thisWeek) {
        grouped.thisWeek.push(notif);
      } else {
        grouped.older.push(notif);
      }
    });

    return NextResponse.json({
      notifications,
      grouped,
      unreadCount,
    });
  } catch (error) {
    console.error('[GET /api/notifications]', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
