import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/communities/[id]/posts
 * List posts with pagination, filtering by type/author/tags
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const type = searchParams.get('type');
    const authorId = searchParams.get('authorId');
    const tag = searchParams.get('tag');

    const skip = (page - 1) * limit;

    // Build where clause
    interface WhereClause {
      communityId: string;
      type?: string;
      authorId?: string;
      tags?: {
        some: {
          name: string;
        };
      };
    }

    const where: WhereClause = {
      communityId: params.id,
    };

    if (type) {
      where.type = type;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (tag) {
      where.tags = {
        some: {
          name: tag,
        },
      };
    }

    // Fetch posts with related data
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
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
          _count: {
            select: {
              comments: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    // Get reaction counts for each post
    const postsWithReactions = await Promise.all(
      posts.map(async (post) => {
        const reactions = await prisma.reaction.groupBy({
          by: ['reactionType'],
          where: {
            reactableType: 'post',
            reactableId: post.id,
          },
          _count: {
            reactionType: true,
          },
        });

        const reactionCounts = reactions.reduce((acc, r) => {
          acc[r.reactionType] = r._count.reactionType;
          return acc;
        }, {} as Record<string, number>);

        return {
          ...post,
          reactions: reactionCounts,
        };
      })
    );

    return NextResponse.json({
      posts: postsWithReactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/communities/[id]/posts]', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/communities/[id]/posts
 * Create new post
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get userId from headers or session
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, type = 'discussion', isPinned = false, tags = [] } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['discussion', 'question', 'announcement'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if user is member of community
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: params.id,
          userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this community' },
        { status: 403 }
      );
    }

    // Only moderators/admins can pin posts
    if (isPinned && !['moderator', 'admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only moderators can pin posts' },
        { status: 403 }
      );
    }

    // Create post with tags
    const post = await prisma.post.create({
      data: {
        title,
        content,
        type,
        isPinned,
        communityId: params.id,
        authorId: userId,
        tags: {
          create: tags.map((tag: { name: string; color?: string }) => ({
            name: tag.name,
            color: tag.color || '#3b82f6',
          })),
        },
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
        tags: true,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('[POST /api/communities/[id]/posts]', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
