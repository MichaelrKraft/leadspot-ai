import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_REACTION_TYPES = ['like', 'love', 'celebrate', 'insightful'];

/**
 * GET /api/posts/[id]/reactions
 * Get all reactions for post
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Get all reactions for this post
    const reactions = await prisma.reaction.findMany({
      where: {
        reactableType: 'post',
        reactableId: params.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group reactions by type
    const reactionsByType = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.reactionType]) {
        acc[reaction.reactionType] = [];
      }
      acc[reaction.reactionType].push({
        userId: reaction.userId,
        user: reaction.user,
        createdAt: reaction.createdAt,
      });
      return acc;
    }, {} as Record<string, Array<{userId: string; user: unknown; createdAt: Date}>>);

    // Get total counts
    const counts = Object.keys(reactionsByType).reduce((acc, type) => {
      acc[type] = reactionsByType[type].length;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      reactions: reactionsByType,
      counts,
      total: reactions.length,
    });
  } catch (error) {
    console.error('[GET /api/posts/[id]/reactions]', error);
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts/[id]/reactions
 * Toggle reaction (like, love, celebrate, insightful)
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

    const body = await request.json();
    const { reactionType } = body;

    // Validate reaction type
    if (!reactionType || !VALID_REACTION_TYPES.includes(reactionType)) {
      return NextResponse.json(
        { error: `Reaction type must be one of: ${VALID_REACTION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        community: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        author: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user is member of community
    if (post.community.members.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this community' },
        { status: 403 }
      );
    }

    // Check if user already reacted with this type
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        reactableType_reactableId_userId_reactionType: {
          reactableType: 'post',
          reactableId: params.id,
          userId,
          reactionType,
        },
      },
    });

    let action: 'added' | 'removed';

    if (existingReaction) {
      // Remove reaction (toggle off)
      await prisma.reaction.delete({
        where: { id: existingReaction.id },
      });
      action = 'removed';
    } else {
      // Add reaction
      await prisma.reaction.create({
        data: {
          reactableType: 'post',
          reactableId: params.id,
          userId,
          reactionType,
        },
      });
      action = 'added';

      // Create notification for post author (if different from reactor)
      if (post.author.id !== userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        await prisma.notification.create({
          data: {
            userId: post.author.id,
            type: 'reaction',
            message: `${user?.name || 'Someone'} reacted ${reactionType} to your post: "${post.title}"`,
            actionUrl: `/communities/${post.communityId}/posts/${post.id}`,
          },
        }).catch((err) => {
          // Don't fail the request if notification creation fails
          console.error('Failed to create notification:', err);
        });
      }
    }

    // Get updated reaction counts
    const reactions = await prisma.reaction.groupBy({
      by: ['reactionType'],
      where: {
        reactableType: 'post',
        reactableId: params.id,
      },
      _count: {
        reactionType: true,
      },
    });

    const counts = reactions.reduce((acc, r) => {
      acc[r.reactionType] = r._count.reactionType;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      action,
      reactionType,
      counts,
    });
  } catch (error) {
    console.error('[POST /api/posts/[id]/reactions]', error);
    return NextResponse.json(
      { error: 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
