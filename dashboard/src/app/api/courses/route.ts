import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/courses - List all courses (with optional filtering)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const isPublished = searchParams.get('isPublished');
    const level = searchParams.get('level');

    interface CourseWhereClause {
      communityId?: string;
      isPublished?: boolean;
      level?: string;
    }

    const where: CourseWhereClause = {};
    if (communityId) where.communityId = communityId;
    if (isPublished !== null) where.isPublished = isPublished === 'true';
    if (level) where.level = level;

    const courses = await prisma.course.findMany({
      where,
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        modules: {
          include: {
            lessons: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate total lessons and duration for each course
    const coursesWithMetadata = courses.map(course => {
      const totalLessons = course.modules.reduce(
        (sum, module) => sum + module.lessons.length,
        0
      );
      const totalDuration = course.modules.reduce(
        (sum, module) => sum + module.lessons.reduce(
          (lessonSum, lesson) => lessonSum + (lesson.videoDuration || 0),
          0
        ),
        0
      );

      return {
        ...course,
        totalLessons,
        totalDuration,
        enrollmentCount: course._count.enrollments,
      };
    });

    return NextResponse.json(coursesWithMetadata);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

// POST /api/courses - Create new course (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      communityId,
      title,
      description,
      instructorId,
      level = 'beginner',
      price = 0,
      isFree = true,
      isPublished = false,
      coverImage,
    } = body;

    // Validation
    if (!communityId || !title || !instructorId) {
      return NextResponse.json(
        { error: 'Missing required fields: communityId, title, instructorId' },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        communityId,
        title,
        description,
        instructorId,
        level,
        price,
        isFree,
        isPublished,
        coverImage,
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}
