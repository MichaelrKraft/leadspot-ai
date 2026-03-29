import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/posts/[id]/comments
 * List comments for post
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

    // Fetch all comments for the post
    const comments = await prisma.comment.findMany({
      where: { postId: params.id },
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
      },
    });

    // Get reaction counts for all comments
    const commentIds = comments.map((c) => c.id);
    const reactions = await prisma.reaction.groupBy({
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
    const reactionsByComment = reactions.reduce((acc, r) => {
      if (!acc[r.reactableId]) {
        acc[r.reactableId] = {};
      }
      acc[r.reactableId][r.reactionType] = r._count.reactionType;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    // Add reactions to comments
    const commentsWithReactions = comments.map((comment) => ({
      ...comment,
      reactions: reactionsByComment[comment.id] || {},
    }));

    return NextResponse.json({ comments: commentsWithReactions });
  } catch (error) {
    console.error('[GET /api/posts/[id]/comments]', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts/[id]/comments
 * Add comment (supports parentCommentId for nesting)
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
    const { content, parentCommentId } = body;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
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

    // If parentCommentId provided, verify it exists and belongs to this post
    if (parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }

      if (parentComment.postId !== params.id) {
        return NextResponse.json(
          { error: 'Parent comment does not belong to this post' },
          { status: 400 }
        );
      }

      // Check nesting depth (limit to 3 levels)
      let depth = 1;
      let currentParent = parentComment;
      while (currentParent.parentCommentId && depth < 3) {
        const nextParent = await prisma.comment.findUnique({
          where: { id: currentParent.parentCommentId },
        });
        if (!nextParent) break;
        currentParent = nextParent;
        depth++;
      }

      if (depth >= 3) {
        return NextResponse.json(
          { error: 'Maximum comment nesting depth reached (3 levels)' },
          { status: 400 }
        );
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        postId: params.id,
        authorId: userId,
        parentCommentId: parentCommentId || null,
      },
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
    });

    // Create notification for post author (if different from commenter)
    if (post.authorId !== userId) {
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: 'comment_on_post',
          message: `${comment.author.name || 'Someone'} commented on your post: "${post.title}"`,
          actionUrl: `/communities/${post.communityId}/posts/${post.id}`,
        },
      }).catch((err) => {
        // Don't fail the request if notification creation fails
        console.error('Failed to create notification:', err);
      });
    }

    // If replying to a comment, notify the parent comment author
    if (parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });

      if (parentComment && parentComment.authorId !== userId) {
        await prisma.notification.create({
          data: {
            userId: parentComment.authorId,
            type: 'reply_to_comment',
            message: `${comment.author.name || 'Someone'} replied to your comment`,
            actionUrl: `/communities/${post.communityId}/posts/${post.id}`,
          },
        }).catch((err) => {
          console.error('Failed to create notification:', err);
        });
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[POST /api/posts/[id]/comments]', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
