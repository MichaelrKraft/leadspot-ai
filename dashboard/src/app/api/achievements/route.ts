import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/achievements
 * Get all achievements for a community
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const userId = searchParams.get('userId');

    if (!communityId) {
      return NextResponse.json(
        { error: 'communityId is required' },
        { status: 400 }
      );
    }

    // Get all achievements for the community
    const achievements = await prisma.achievement.findMany({
      where: {
        communityId,
      },
      orderBy: {
        pointsValue: 'desc',
      },
    });

    // If userId provided, include user's achievement status
    if (userId) {
      const userAchievements = await prisma.userAchievement.findMany({
        where: {
          userId,
          achievementId: {
            in: achievements.map((a) => a.id),
          },
        },
        select: {
          achievementId: true,
          earnedAt: true,
        },
      });

      const userAchievementMap = new Map(
        userAchievements.map((ua) => [ua.achievementId, ua.earnedAt])
      );

      const achievementsWithStatus = achievements.map((achievement) => ({
        ...achievement,
        isEarned: userAchievementMap.has(achievement.id),
        earnedAt: userAchievementMap.get(achievement.id) || null,
      }));

      return NextResponse.json({
        achievements: achievementsWithStatus,
        count: achievementsWithStatus.length,
        earnedCount: userAchievements.length,
      });
    }

    return NextResponse.json({
      achievements,
      count: achievements.length,
    });
  } catch (error) {
    console.error('[GET /api/achievements]', error);
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}
