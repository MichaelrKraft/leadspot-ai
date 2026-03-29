import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/community/[slug]/posts/[postId]/comments/[commentId]/react - React to comment
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; postId: string; commentId: string } }
) {
  try {
    const { commentId } = params;
    const body = await request.json();
    const { type: reactionType, userId } = body;

    // Validation
    if (!reactionType || !['like', 'love', 'celebrate', 'insightful'].includes(reactionType)) {
      return NextResponse.json(
        { error: 'Valid reaction type required (like, love, celebrate, insightful)' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required - authentication needed' },
        { status: 401 }
      );
    }

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: true,
        post: true,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user already reacted with this type
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        reactableType: 'comment',
        reactableId: commentId,
        userId,
        reactionType,
      },
    });

    if (existingReaction) {
      // Remove reaction (toggle off)
      await prisma.reaction.delete({
        where: { id: existingReaction.id },
      });

      return NextResponse.json({ message: 'Reaction removed', removed: true });
    } else {
      // Add reaction
      await prisma.reaction.create({
        data: {
          reactableType: 'comment',
          reactableId: commentId,
          userId,
          reactionType,
        },
      });

      // Award points to comment author (if not reacting to own comment)
      if (comment.authorId !== userId) {
        await prisma.pointTransaction.create({
          data: {
            userId: comment.authorId,
            points: 2,
            reason: `Received ${reactionType} reaction on comment`,
            sourceType: 'reaction_received',
            sourceId: commentId,
          },
        });

        // Update comment author's community points
        const authorMembership = await prisma.communityMember.findFirst({
          where: {
            communityId: comment.post.communityId,
            userId: comment.authorId,
          },
        });

        if (authorMembership) {
          await prisma.communityMember.update({
            where: { id: authorMembership.id },
            data: {
              points: {
                increment: 2,
              },
            },
          });
        }
      }

      return NextResponse.json({ message: 'Reaction added', added: true }, { status: 201 });
    }
  } catch (error) {
    console.error('Error handling comment reaction:', error);
    return NextResponse.json(
      { error: 'Failed to handle reaction' },
      { status: 500 }
    );
  }
}
