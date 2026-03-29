'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
  videoDuration: number | null;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  instructor: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  community: {
    id: string;
    name: string;
    slug: string;
  };
  level: string;
  isFree: boolean;
  price: number;
  coverImage: string | null;
  modules: Module[];
  moduleCount: number;
  lessonCount: number;
  totalDuration: number;
  enrollmentCount: number;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/courses/${courseId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch course');
        }

        const data = await response.json();
        setCourse(data);
      } catch (err) {
        console.error('Error fetching course:', err);
        setError('Failed to load course. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-accent-green/10 text-accent-green border-accent-green/30';
      case 'intermediate':
        return 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      case 'advanced':
        return 'bg-accent-red/10 text-accent-red border-accent-red/30';
      default:
        return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30';
    }
  };

  // Demo user ID for development - TODO: Replace with NextAuth.js session
  const DEMO_USER_ID = 'demo-user-001';

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      // First check if already enrolled
      const checkResponse = await fetch(
        `/api/courses/${courseId}/enrollment?userId=${DEMO_USER_ID}`
      );

      if (checkResponse.ok) {
        // Already enrolled - redirect to learn page
        router.push(`/community/${params.slug}/courses/${courseId}/learn`);
        return;
      }

      // Not enrolled - create enrollment
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: DEMO_USER_ID }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enroll');
      }

      // Enrollment successful - redirect to learn page
      router.push(`/community/${params.slug}/courses/${courseId}/learn`);
    } catch (err) {
      console.error('Enrollment error:', err);
      alert(err instanceof Error ? err.message : 'Failed to enroll. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-6 text-center max-w-md">
          <svg className="w-12 h-12 text-accent-red mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-accent-red font-medium mb-2">Error Loading Course</p>
          <p className="text-text-secondary text-sm mb-4">{error || 'Course not found'}</p>
          <Link
            href={`/community/${params.slug}/courses`}
            className="inline-block px-4 py-2 bg-accent-cyan text-white rounded-lg hover:bg-accent-cyan/80 transition-colors"
          >
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header with Cover Image */}
      <div className="relative h-80 bg-bg-tertiary">
        {course.coverImage ? (
          <Image
            src={course.coverImage}
            alt={course.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20">
            <svg className="w-24 h-24 text-accent-cyan/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent"></div>

        {/* Breadcrumb */}
        <div className="absolute top-6 left-6">
          <Link
            href={`/community/${course.community.slug}/courses`}
            className="text-text-secondary hover:text-accent-cyan transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </Link>
        </div>
      </div>

      {/* Course Info */}
      <div className="max-w-7xl mx-auto px-6 -mt-20 relative z-10">
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-8 mb-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column - Course Details */}
            <div className="flex-1">
              {/* Level Badge */}
              <div className="mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getLevelColor(course.level)}`}>
                  {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-4xl font-bold text-text-primary mb-4">{course.title}</h1>

              {/* Description */}
              {course.description && (
                <p className="text-text-secondary text-lg mb-6 whitespace-pre-wrap">{course.description}</p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-text-primary font-medium">{course.lessonCount} lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-text-primary font-medium">{formatDuration(course.totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-text-primary font-medium">{course.enrollmentCount} students enrolled</span>
                </div>
              </div>

              {/* Instructor */}
              <div className="border-t border-border-subtle pt-6">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Instructor</h3>
                <div className="flex items-center gap-3">
                  {course.instructor.avatar ? (
                    <Image
                      src={course.instructor.avatar}
                      alt={course.instructor.name || 'Instructor'}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan text-lg font-semibold">
                      {course.instructor.name?.charAt(0) || 'I'}
                    </div>
                  )}
                  <div>
                    <div className="text-text-primary font-medium">{course.instructor.name || 'Anonymous'}</div>
                    <div className="text-text-secondary text-sm">{course.instructor.email}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Enrollment Card */}
            <div className="lg:w-80">
              <div className="bg-bg-tertiary rounded-xl border border-border-subtle p-6 sticky top-6">
                {/* Price */}
                <div className="text-center mb-6">
                  {course.isFree ? (
                    <div className="text-accent-green text-3xl font-bold">FREE</div>
                  ) : (
                    <div className="text-text-primary text-3xl font-bold">${course.price}</div>
                  )}
                </div>

                {/* Enroll Button */}
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full px-6 py-3 bg-accent-cyan text-white rounded-lg font-semibold hover:bg-accent-cyan/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>

                {/* What's Included */}
                <div className="space-y-3">
                  <div className="text-text-secondary text-sm font-medium mb-2">What's included:</div>
                  <div className="flex items-center gap-2 text-text-secondary text-sm">
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {course.moduleCount} modules with {course.lessonCount} lessons
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary text-sm">
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {formatDuration(course.totalDuration)} of video content
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary text-sm">
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Lifetime access
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary text-sm">
                    <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Certificate of completion
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Curriculum */}
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-8 mb-8">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Course Curriculum</h2>

          {course.modules.length === 0 ? (
            <p className="text-text-secondary">No modules available yet.</p>
          ) : (
            <div className="space-y-4">
              {course.modules.map((module, moduleIndex) => (
                <div key={module.id} className="bg-bg-tertiary rounded-lg border border-border-subtle overflow-hidden">
                  {/* Module Header */}
                  <div className="p-4 border-b border-border-subtle">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-text-primary mb-1">
                          Module {moduleIndex + 1}: {module.title}
                        </h3>
                        {module.description && (
                          <p className="text-text-secondary text-sm">{module.description}</p>
                        )}
                      </div>
                      <div className="text-text-secondary text-sm ml-4">
                        {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Lessons List */}
                  <div className="divide-y divide-border-subtle">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.id} className="p-4 hover:bg-bg-primary/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-bg-primary flex items-center justify-center text-text-secondary text-sm">
                              {lessonIndex + 1}
                            </div>
                            <span className="text-text-primary">{lesson.title}</span>
                          </div>
                          {lesson.videoDuration && (
                            <span className="text-text-secondary text-sm">
                              {formatDuration(lesson.videoDuration)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
