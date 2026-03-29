import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/lessons/[id]/progress - Update lesson watch progress
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: lessonId } = params;
    const body = await request.json();
    const { userId, watchedSeconds } = body;

    if (!userId || watchedSeconds === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, watchedSeconds' },
        { status: 400 }
      );
    }

    // Get lesson info
    const lesson = await prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              include: {
                modules: {
                  include: {
                    lessons: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    // Get or create enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId: lesson.module.course.id,
          userId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'User not enrolled in this course' },
        { status: 403 }
      );
    }

    // Calculate if lesson is completed (90% watched)
    const videoDuration = lesson.videoDuration || 0;
    const isCompleted = videoDuration > 0 && watchedSeconds >= videoDuration * 0.9;

    // Update or create lesson progress
    const progress = await prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId,
        },
      },
      update: {
        watchedSeconds,
        isCompleted,
        ...(isCompleted && !lesson.videoDuration ? { completedAt: new Date() } : {}),
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        userId,
        watchedSeconds,
        isCompleted,
        ...(isCompleted ? { completedAt: new Date() } : {}),
      },
    });

    // If just completed, award points
    if (isCompleted && !progress.completedAt) {
      await prisma.pointTransaction.create({
        data: {
          userId,
          points: 25,
          reason: 'Completed a lesson',
          sourceType: 'lesson_completion',
          sourceId: lessonId,
        },
      });

      // Update community points
      const communityMember = await prisma.communityMember.findFirst({
        where: {
          communityId: lesson.module.course.communityId,
          userId,
        },
      });

      if (communityMember) {
        await prisma.communityMember.update({
          where: { id: communityMember.id },
          data: {
            points: {
              increment: 25,
            },
          },
        });
      }
    }

    // Recalculate course progress
    const allLessons = lesson.module.course.modules.flatMap(m => m.lessons);
    const completedLessons = await prisma.lessonProgress.count({
      where: {
        enrollmentId: enrollment.id,
        isCompleted: true,
      },
    });

    const progressPercent = Math.round((completedLessons / allLessons.length) * 100);
    const courseCompleted = progressPercent === 100;

    // Update enrollment
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercent,
        isCompleted: courseCompleted,
        ...(courseCompleted && !enrollment.isCompleted ? { completedAt: new Date() } : {}),
      },
    });

    // If course just completed, award bonus points
    if (courseCompleted && !enrollment.isCompleted) {
      await prisma.pointTransaction.create({
        data: {
          userId,
          points: 100,
          reason: 'Completed a course',
          sourceType: 'course_completion',
          sourceId: lesson.module.course.id,
        },
      });

      // Update community points
      const communityMember = await prisma.communityMember.findFirst({
        where: {
          communityId: lesson.module.course.communityId,
          userId,
        },
      });

      if (communityMember) {
        await prisma.communityMember.update({
          where: { id: communityMember.id },
          data: {
            points: {
              increment: 100,
            },
          },
        });
      }
    }

    return NextResponse.json({
      progress,
      courseProgress: progressPercent,
      courseCompleted,
    });
  } catch (error) {
    console.error('Error updating lesson progress:', error);
    return NextResponse.json(
      { error: 'Failed to update lesson progress' },
      { status: 500 }
    );
  }
}
