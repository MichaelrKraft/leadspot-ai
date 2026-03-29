import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/community/[slug]/posts/[id]/reactions - Add or remove reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { id: postId } = params;
    const body = await request.json();
    const { reactionType, userId } = body;

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

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user already reacted with this type
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        reactableType: 'post',
        reactableId: postId,
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
          reactableType: 'post',
          reactableId: postId,
          userId,
          reactionType,
        },
      });

      // Award points to post author (if not reacting to own post)
      if (post.authorId !== userId) {
        await prisma.pointTransaction.create({
          data: {
            userId: post.authorId,
            points: 2,
            reason: `Received ${reactionType} reaction`,
            sourceType: 'reaction_received',
            sourceId: postId,
          },
        });

        // Update post author's community points
        const authorMembership = await prisma.communityMember.findFirst({
          where: {
            communityId: post.communityId,
            userId: post.authorId,
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
    console.error('Error handling reaction:', error);
    return NextResponse.json(
      { error: 'Failed to handle reaction' },
      { status: 500 }
    );
  }
}
