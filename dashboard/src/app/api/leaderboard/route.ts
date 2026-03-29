import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/leaderboard
 * Get leaderboard rankings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const period = searchParams.get('period') || 'all-time'; // all-time, month, week
    const limit = parseInt(searchParams.get('limit') || '10');

    // Calculate points for each user
    interface UserPoints {
      userId: string;
      totalPoints: number;
    }

    interface WhereClause {
      createdAt?: {
        gte: Date;
      };
    }

    const where: WhereClause = {};

    // Filter by time period
    if (period === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      where.createdAt = { gte: startOfMonth };
    } else if (period === 'week') {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      where.createdAt = { gte: startOfWeek };
    }

    // Get point transactions grouped by user
    const pointTransactions = await prisma.pointTransaction.findMany({
      where,
      select: {
        userId: true,
        points: true,
      },
    });

    // Sum points per user
    const userPointsMap = pointTransactions.reduce((acc, transaction) => {
      if (!acc[transaction.userId]) {
        acc[transaction.userId] = 0;
      }
      acc[transaction.userId] += transaction.points;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort
    const userPointsArray: UserPoints[] = Object.entries(userPointsMap).map(
      ([userId, totalPoints]) => ({
        userId,
        totalPoints,
      })
    );

    userPointsArray.sort((a, b) => b.totalPoints - a.totalPoints);

    // Take top N
    const topUsers = userPointsArray.slice(0, limit);

    // Fetch user details
    const userIds = topUsers.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    // Combine points with user details
    const leaderboard = topUsers.map((userPoints, index) => {
      const user = users.find((u) => u.id === userPoints.userId);
      return {
        rank: index + 1,
        user: user || null,
        points: userPoints.totalPoints,
      };
    });

    // If communityId is provided, filter by community members
    let filteredLeaderboard = leaderboard;
    if (communityId) {
      const communityMembers = await prisma.communityMember.findMany({
        where: { communityId },
        select: { userId: true },
      });

      const memberUserIds = new Set(communityMembers.map((m) => m.userId));
      filteredLeaderboard = leaderboard
        .filter((entry) => entry.user && memberUserIds.has(entry.user.id))
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    return NextResponse.json({
      period,
      leaderboard: filteredLeaderboard,
      count: filteredLeaderboard.length,
    });
  } catch (error) {
    console.error('[GET /api/leaderboard]', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
