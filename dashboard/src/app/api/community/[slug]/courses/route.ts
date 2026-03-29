import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/community/[slug]/courses - List courses in a community
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level'); // beginner, intermediate, advanced
    const isFree = searchParams.get('isFree');

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
    interface CourseWhereClause {
      communityId: string;
      isPublished: boolean;
      level?: string;
      isFree?: boolean;
    }

    const where: CourseWhereClause = {
      communityId: community.id,
      isPublished: true, // Only show published courses
    };

    if (level) {
      where.level = level;
    }

    if (isFree !== null && isFree !== undefined) {
      where.isFree = isFree === 'true';
    }

    // Fetch courses
    const courses = await prisma.course.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            modules: true,
            enrollments: true,
          },
        },
      },
    });

    // Calculate total lessons and duration for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        // Get all lessons for this course through modules
        const modules = await prisma.courseModule.findMany({
          where: { courseId: course.id },
          include: {
            lessons: {
              select: {
                videoDuration: true,
              },
            },
          },
        });

        const totalLessons = modules.reduce(
          (sum, module) => sum + module.lessons.length,
          0
        );

        const totalDuration = modules.reduce(
          (sum, module) =>
            sum +
            module.lessons.reduce(
              (lessonSum, lesson) => lessonSum + (lesson.videoDuration || 0),
              0
            ),
          0
        );

        return {
          ...course,
          moduleCount: course._count.modules,
          enrollmentCount: course._count.enrollments,
          lessonCount: totalLessons,
          totalDuration, // in seconds
        };
      })
    );

    return NextResponse.json({ courses: coursesWithStats });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
