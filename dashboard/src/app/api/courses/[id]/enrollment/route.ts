import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/courses/[id]/enrollment - Check if user is enrolled in a course
 * 
 * Query params:
 *   - userId: string (required) - The user ID to check enrollment for
 * 
 * Returns:
 *   - 200: Enrollment data with lesson progress
 *   - 400: Missing userId parameter
 *   - 404: Not enrolled in this course
 *   - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: courseId } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Find enrollment with lesson progress
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId,
        },
      },
      include: {
        lessonProgress: {
          select: {
            id: true,
            lessonId: true,
            isCompleted: true,
            watchedSeconds: true,
            completedAt: true,
          },
        },
        course: {
          include: {
            modules: {
              include: {
                lessons: {
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
            instructor: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Not enrolled in this course' },
        { status: 404 }
      );
    }

    // Transform lessonProgress to a map for easier lookup
    const lessonProgressMap: Record<string, {
      id: string;
      lessonId: string;
      isCompleted: boolean;
      watchedSeconds: number;
      completedAt: Date | null;
    }> = {};
    
    enrollment.lessonProgress.forEach((progress) => {
      lessonProgressMap[progress.lessonId] = progress;
    });

    // Calculate total lessons and completed count
    const totalLessons = enrollment.course.modules.reduce(
      (sum, module) => sum + module.lessons.length,
      0
    );
    const completedLessons = enrollment.lessonProgress.filter(
      (p) => p.isCompleted
    ).length;

    // Find last watched lesson for resume functionality
    const lastWatchedProgress = enrollment.lessonProgress
      .filter((p) => p.watchedSeconds > 0)
      .sort((a, b) => {
        // Sort by most recently updated (completedAt or just the order)
        const aTime = a.completedAt?.getTime() || 0;
        const bTime = b.completedAt?.getTime() || 0;
        return bTime - aTime;
      })[0];

    // Find first incomplete lesson (for auto-resume)
    let firstIncompleteLessonId: string | null = null;
    for (const courseModule of enrollment.course.modules) {
      for (const lesson of courseModule.lessons) {
        const progress = lessonProgressMap[lesson.id];
        if (!progress || !progress.isCompleted) {
          firstIncompleteLessonId = lesson.id;
          break;
        }
      }
      if (firstIncompleteLessonId) break;
    }

    return NextResponse.json({
      id: enrollment.id,
      courseId: enrollment.courseId,
      userId: enrollment.userId,
      progressPercent: enrollment.progressPercent,
      isCompleted: enrollment.isCompleted,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      course: enrollment.course,
      lessonProgress: lessonProgressMap,
      stats: {
        totalLessons,
        completedLessons,
        lastWatchedLessonId: lastWatchedProgress?.lessonId || null,
        firstIncompleteLessonId,
      },
    });
  } catch (error) {
    console.error('Error checking enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to check enrollment status' },
      { status: 500 }
    );
  }
}
