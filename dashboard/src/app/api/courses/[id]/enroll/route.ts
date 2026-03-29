import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/courses/[id]/enroll - Enroll user in course
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: courseId } = params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Already enrolled in this course' },
        { status: 400 }
      );
    }

    // Create enrollment
    const enrollment = await prisma.courseEnrollment.create({
      data: {
        courseId,
        userId,
        progressPercent: 0,
        isCompleted: false,
      },
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
    });

    // Award points for enrollment
    await prisma.pointTransaction.create({
      data: {
        userId,
        points: 10,
        reason: 'Enrolled in a course',
        sourceType: 'course_enrollment',
        sourceId: courseId,
      },
    });

    // Update user's community points
    const communityMember = await prisma.communityMember.findFirst({
      where: {
        communityId: course.communityId,
        userId,
      },
    });

    if (communityMember) {
      await prisma.communityMember.update({
        where: { id: communityMember.id },
        data: {
          points: {
            increment: 10,
          },
        },
      });
    }

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    return NextResponse.json(
      { error: 'Failed to enroll in course' },
      { status: 500 }
    );
  }
}
