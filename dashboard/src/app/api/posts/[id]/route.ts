import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/posts/[id]
 * Get single post with all comments (nested up to 3 levels)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        tags: true,
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
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

    // Fetch comments with nested structure (up to 3 levels)
    const topLevelComments = await prisma.comment.findMany({
      where: {
        postId: params.id,
        parentCommentId: null,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
                role: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    role: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Get reaction counts for post
    const postReactions = await prisma.reaction.groupBy({
      by: ['reactionType'],
      where: {
        reactableType: 'post',
        reactableId: params.id,
      },
      _count: {
        reactionType: true,
      },
    });

    const postReactionCounts = postReactions.reduce((acc, r) => {
      acc[r.reactionType] = r._count.reactionType;
      return acc;
    }, {} as Record<string, number>);

    // Get reaction counts for all comments
    const commentIds = topLevelComments.flatMap((c) => [
      c.id,
      ...c.replies.map((r) => r.id),
      ...c.replies.flatMap((r) => r.replies.map((rr) => rr.id)),
    ]);

    const commentReactions = await prisma.reaction.groupBy({
      by: ['reactableId', 'reactionType'],
      where: {
        reactableType: 'comment',
        reactableId: { in: commentIds },
      },
      _count: {
        reactionType: true,
      },
    });

    // Map reaction counts to comments
    const reactionsByComment = commentReactions.reduce((acc, r) => {
      if (!acc[r.reactableId]) {
        acc[r.reactableId] = {};
      }
      acc[r.reactableId][r.reactionType] = r._count.reactionType;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    // Add reactions to comments (recursive function for nested comments)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addReactionsToComments = (comments: any[]): any[] => {
      return comments.map((comment) => ({
        ...comment,
        reactions: reactionsByComment[comment.id] || {},
        replies: comment.replies ? addReactionsToComments(comment.replies) : [],
      }));
    };

    const commentsWithReactions = addReactionsToComments(topLevelComments);

    return NextResponse.json({
      ...post,
      reactions: postReactionCounts,
      comments: commentsWithReactions,
      commentCount: commentIds.length,
    });
  } catch (error) {
    console.error('[GET /api/posts/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/posts/[id]
 * Update post (author only, 15min window)
 */
export async function PATCH(
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
    const { title, content, type, isPinned, tags } = body;

    // Fetch existing post
    const existingPost = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        community: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user is the author
    const isAuthor = existingPost.authorId === userId;
    const membership = existingPost.community.members[0];
    const isModerator = membership && ['moderator', 'admin', 'owner'].includes(membership.role);

    if (!isAuthor && !isModerator) {
      return NextResponse.json(
        { error: 'You can only edit your own posts' },
        { status: 403 }
      );
    }

    // Check 15-minute edit window for regular users
    if (isAuthor && !isModerator) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (existingPost.createdAt < fifteenMinutesAgo) {
        return NextResponse.json(
          { error: 'Edit window has expired (15 minutes)' },
          { status: 403 }
        );
      }
    }

    // Only moderators can change isPinned
    if (isPinned !== undefined && !isModerator) {
      return NextResponse.json(
        { error: 'Only moderators can pin posts' },
        { status: 403 }
      );
    }

    // Build update data
    interface UpdateData {
      title?: string;
      content?: string;
      type?: string;
      isPinned?: boolean;
      tags?: {
        create: Array<{ name: string; color: string }>;
      };
    }
    const updateData: UpdateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (isPinned !== undefined) updateData.isPinned = isPinned;

    // Handle tags update
    if (tags !== undefined) {
      // Delete existing tags and create new ones
      await prisma.postTag.deleteMany({
        where: { postId: params.id },
      });

      updateData.tags = {
        create: tags.map((tag: { name: string; color?: string }) => ({
          name: tag.name,
          color: tag.color || '#3b82f6',
        })),
      };
    }

    const updatedPost = await prisma.post.update({
      where: { id: params.id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        tags: true,
      },
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('[PATCH /api/posts/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]
 * Delete post (author/admin only)
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

    // Fetch existing post
    const existingPost = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        community: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user is the author or moderator
    const isAuthor = existingPost.authorId === userId;
    const membership = existingPost.community.members[0];
    const isModerator = membership && ['moderator', 'admin', 'owner'].includes(membership.role);

    if (!isAuthor && !isModerator) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      );
    }

    // Delete post (cascade will handle comments, tags, reactions)
    await prisma.post.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { message: 'Post deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/posts/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
