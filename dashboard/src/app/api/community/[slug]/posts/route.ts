import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/community/[slug]/posts - List posts in a community
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const sortBy = searchParams.get('sortBy') || 'recent';

    // Get community
    const community = await prisma.community.findUnique({
      where: { slug },
    });

    if (!community) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    // Build where clause
    interface PostWhereClause {
      communityId: string;
      type?: string;
    }

    const where: PostWhereClause = {
      communityId: community.id,
    };

    if (filter === 'questions') {
      where.type = 'question';
    } else if (filter === 'announcements') {
      where.type = 'announcement';
    }

    // Build orderBy clause
    interface PostOrderBy {
      createdAt?: 'asc' | 'desc';
      isPinned?: 'desc';
    }

    const orderBy: PostOrderBy[] = [];
    orderBy.push({ isPinned: 'desc' }); // Pinned posts first

    if (sortBy === 'recent') {
      orderBy.push({ createdAt: 'desc' });
    } else if (sortBy === 'oldest') {
      orderBy.push({ createdAt: 'asc' });
    }

    // Fetch posts
    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: 20,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    // Add empty reactions for now (TODO: optimize with single query)
    const postsWithReactions = posts.map((post) => ({
      ...post,
      reactions: { like: 0, love: 0, celebrate: 0, insightful: 0 },
      commentCount: post._count.comments,
    }));

    return NextResponse.json({ posts: postsWithReactions });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// POST /api/community/[slug]/posts - Create new post
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { title, content, type = 'discussion', tags = [], userId } = body;

    // Validation
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required - authentication needed' },
        { status: 401 }
      );
    }

    // Get community
    const community = await prisma.community.findUnique({
      where: { slug },
    });

    if (!community) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    // Verify user is a member
    const membership = await prisma.communityMember.findFirst({
      where: {
        communityId: community.id,
        userId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a community member to post' },
        { status: 403 }
      );
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        communityId: community.id,
        authorId: userId,
        title,
        content,
        type,
        isPinned: false,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Create tags if provided
    if (tags.length > 0) {
      await Promise.all(
        tags.map((tagName: string) =>
          prisma.postTag.upsert({
            where: {
              postId_name: {
                postId: post.id,
                name: tagName.toLowerCase(),
              },
            },
            create: {
              postId: post.id,
              name: tagName.toLowerCase(),
            },
            update: {},
          })
        )
      );
    }

    // Award points for creating a post
    await prisma.pointTransaction.create({
      data: {
        userId,
        points: 10,
        reason: 'Created a post',
        sourceType: 'post_creation',
        sourceId: post.id,
      },
    });

    // Update community member points
    await prisma.communityMember.update({
      where: { id: membership.id },
      data: {
        points: {
          increment: 10,
        },
      },
    });

    // Return created post with reactions structure
    return NextResponse.json({
      ...post,
      reactions: { like: 0, love: 0, celebrate: 0, insightful: 0 },
      commentCount: 0,
      tags,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
