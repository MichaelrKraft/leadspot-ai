'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import CoursePlayer from '@/components/courses/CoursePlayer';
import CourseSidebar from '@/components/courses/CourseSidebar';
import { Course, CourseLesson, LessonProgress } from '@/types/course';

// Demo user ID for development - TODO: Replace with NextAuth.js session
// In production, use: const session = await getServerSession(); const userId = session?.user?.id;
const DEMO_USER_ID = 'demo-user-001';

interface EnrollmentData {
  id: string;
  courseId: string;
  userId: string;
  progressPercent: number;
  isCompleted: boolean;
  enrolledAt: string;
  completedAt: string | null;
  course: Course & {
    instructor: {
      id: string;
      name: string | null;
      email: string;
      avatar: string | null;
    };
  };
  lessonProgress: Record<string, LessonProgress>;
  stats: {
    totalLessons: number;
    completedLessons: number;
    lastWatchedLessonId: string | null;
    firstIncompleteLessonId: string | null;
  };
}

export default function CourseLearnPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const slug = params.slug as string;
  const courseId = params.id as string;
  const lessonIdFromUrl = searchParams.get('lesson');

  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<CourseLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch enrollment data on mount
  useEffect(() => {
    const fetchEnrollment = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/courses/${courseId}/enrollment?userId=${DEMO_USER_ID}`
        );

        if (response.status === 404) {
          // Not enrolled - redirect to course detail page
          router.push(`/community/${slug}/courses/${courseId}`);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch enrollment data');
        }

        const data: EnrollmentData = await response.json();
        setEnrollment(data);

        // Determine which lesson to show
        let targetLessonId = lessonIdFromUrl;

        if (!targetLessonId) {
          // No lesson in URL - try to resume from last position
          if (data.stats.lastWatchedLessonId) {
            targetLessonId = data.stats.lastWatchedLessonId;
          } else if (data.stats.firstIncompleteLessonId) {
            targetLessonId = data.stats.firstIncompleteLessonId;
          } else {
            // Fall back to first lesson
            targetLessonId = data.course.modules?.[0]?.lessons?.[0]?.id || null;
          }
        }

        // Find and set the current lesson
        if (targetLessonId && data.course.modules) {
          const lesson = findLessonById(data.course.modules, targetLessonId);
          if (lesson) {
            setCurrentLesson(lesson);
            // Update URL if we auto-selected a lesson
            if (!lessonIdFromUrl && targetLessonId) {
              router.replace(
                `/community/${slug}/courses/${courseId}/learn?lesson=${targetLessonId}`,
                { scroll: false }
              );
            }
          }
        }
      } catch (err) {
        console.error('Error fetching enrollment:', err);
        setError('Failed to load course. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchEnrollment();
  }, [courseId, slug, router, lessonIdFromUrl]);

  // Helper function to find a lesson by ID
  const findLessonById = (
    modules: Course['modules'],
    lessonId: string
  ): CourseLesson | null => {
    if (!modules) return null;
    for (const courseModule of modules) {
      const lesson = courseModule.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  };

  // Handle lesson selection from sidebar
  const handleLessonSelect = useCallback(
    (lesson: CourseLesson) => {
      setCurrentLesson(lesson);
      router.push(
        `/community/${slug}/courses/${courseId}/learn?lesson=${lesson.id}`,
        { scroll: false }
      );
    },
    [router, slug, courseId]
  );

  // Handle lesson completion - refresh enrollment data
  // Prefixed with _ as it's prepared for future use (auto-refresh on completion)
  const _handleLessonComplete = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/courses/${courseId}/enrollment?userId=${DEMO_USER_ID}`
      );
      if (response.ok) {
        const data: EnrollmentData = await response.json();
        setEnrollment(data);
      }
    } catch (err) {
      console.error('Error refreshing enrollment:', err);
    }
  }, [courseId]);

  // Handle auto-advance to next lesson
  const handleNextLesson = useCallback(() => {
    if (!enrollment?.course.modules || !currentLesson) return;

    const allLessons = enrollment.course.modules.flatMap((m) => m.lessons);
    const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);

    if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentIndex + 1];
      handleLessonSelect(nextLesson);
    }
  }, [enrollment, currentLesson, handleLessonSelect]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00D9FF]/30 border-t-[#00D9FF] rounded-full animate-spin" />
          <p className="text-[#a0a0a0]">Loading course...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center max-w-md">
          <svg
            className="w-12 h-12 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-red-500 font-medium mb-2">Error Loading Course</p>
          <p className="text-[#a0a0a0] text-sm mb-4">{error}</p>
          <Link
            href={`/community/${slug}/courses/${courseId}`}
            className="inline-block px-4 py-2 bg-[#00D9FF] text-white rounded-lg hover:bg-[#00D9FF]/80 transition-colors"
          >
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  // No enrollment data
  if (!enrollment) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="bg-[#141414] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/community/${slug}/courses/${courseId}`}
            className="text-[#a0a0a0] hover:text-white transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">Back to Course</span>
          </Link>
          <div className="hidden md:block h-6 w-px bg-[#2a2a2a]" />
          <h1 className="text-white font-medium truncate max-w-md">
            {enrollment.course.title}
          </h1>
        </div>

        {/* Progress indicator in header */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-[#a0a0a0]">
              {enrollment.stats.completedLessons}/{enrollment.stats.totalLessons} lessons
            </span>
            <div className="w-24 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] transition-all duration-300"
                style={{ width: `${enrollment.progressPercent}%` }}
              />
            </div>
            <span className="text-[#00D9FF] font-medium">
              {enrollment.progressPercent}%
            </span>
          </div>

          {enrollment.isCompleted && (
            <div className="flex items-center gap-1 text-green-400 text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">Completed</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content - Sidebar + Player */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar - Collapsible on mobile */}
        <aside className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[#2a2a2a] bg-[#141414] flex-shrink-0 overflow-hidden">
          <div className="h-full max-h-[40vh] lg:max-h-full overflow-y-auto">
            <CourseSidebar
              course={enrollment.course}
              currentLesson={currentLesson}
              onLessonSelect={handleLessonSelect}
              userId={DEMO_USER_ID}
            />
          </div>
        </aside>

        {/* Course Player */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <CoursePlayer
              lesson={currentLesson}
              courseId={courseId}
              userId={DEMO_USER_ID}
            />

            {/* Next Lesson Button (shown after video ends) */}
            {currentLesson && enrollment.course.modules && (
              <NextLessonButton
                currentLesson={currentLesson}
                modules={enrollment.course.modules}
                lessonProgress={enrollment.lessonProgress}
                onNextLesson={handleNextLesson}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Next Lesson Button Component
interface NextLessonButtonProps {
  currentLesson: CourseLesson;
  modules: Course['modules'];
  lessonProgress: Record<string, LessonProgress>;
  onNextLesson: () => void;
}

function NextLessonButton({
  currentLesson,
  modules,
  lessonProgress,
  onNextLesson,
}: NextLessonButtonProps) {
  if (!modules) return null;

  const allLessons = modules.flatMap((m) => m.lessons);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);
  const isLastLesson = currentIndex === allLessons.length - 1;
  const isCurrentCompleted = lessonProgress[currentLesson.id]?.isCompleted;

  if (isLastLesson || !isCurrentCompleted) return null;

  const nextLesson = allLessons[currentIndex + 1];

  return (
    <div className="p-6 bg-[#141414] border-t border-[#2a2a2a]">
      <button
        onClick={onNextLesson}
        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] text-white font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        <span>Next: {nextLesson?.title}</span>
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
