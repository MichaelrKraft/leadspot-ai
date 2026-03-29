import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/[id]/points
 * Get user's points, level, and recent transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get all point transactions for user
    const transactions = await prisma.pointTransaction.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Calculate total points
    const totalPoints = transactions.reduce(
      (sum, transaction) => sum + transaction.points,
      0
    );

    // Calculate level (Level 1: 0-99, Level 2: 100-299, Level 3: 300-999, etc.)
    const calculateLevel = (points: number): number => {
      if (points < 100) return 1;
      if (points < 300) return 2;
      if (points < 1000) return 3;
      if (points < 2500) return 4;
      if (points < 5000) return 5;
      if (points < 10000) return 6;
      return 7 + Math.floor((points - 10000) / 5000);
    };

    // Calculate next level thresholds
    const getLevelThresholds = (level: number): { min: number; max: number } => {
      const thresholds = [
        { min: 0, max: 99 },
        { min: 100, max: 299 },
        { min: 300, max: 999 },
        { min: 1000, max: 2499 },
        { min: 2500, max: 4999 },
        { min: 5000, max: 9999 },
      ];

      if (level <= 6) {
        return thresholds[level - 1];
      }

      // For levels 7+
      const min = 10000 + (level - 7) * 5000;
      return { min, max: min + 4999 };
    };

    const level = calculateLevel(totalPoints);
    const levelThresholds = getLevelThresholds(level);
    const pointsInLevel = totalPoints - levelThresholds.min;
    const pointsForNextLevel = levelThresholds.max - levelThresholds.min + 1;
    const progressPercent = Math.floor((pointsInLevel / pointsForNextLevel) * 100);

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user,
      points: {
        total: totalPoints,
        level,
        levelThresholds,
        pointsInLevel,
        pointsForNextLevel,
        progressPercent,
      },
      transactions,
    });
  } catch (error) {
    console.error('[GET /api/users/[id]/points]', error);
    return NextResponse.json(
      { error: 'Failed to fetch user points' },
      { status: 500 }
    );
  }
}
