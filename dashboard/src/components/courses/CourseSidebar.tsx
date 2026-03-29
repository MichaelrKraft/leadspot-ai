'use client';

import { useEffect, useState } from 'react';
import ProgressTracker from './ProgressTracker';
import { Course, CourseModule, CourseLesson, CourseEnrollmentWithProgress } from '@/types/course';

interface CourseSidebarProps {
  course: Course;
  currentLesson: CourseLesson | null;
  onLessonSelect: (lesson: CourseLesson) => void;
  userId: string;
}

interface EnrollmentResponse {
  enrollments?: Array<{
    userId: string;
  } & CourseEnrollmentWithProgress>;
}

export default function CourseSidebar({
  course,
  currentLesson,
  onLessonSelect,
  userId,
}: CourseSidebarProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [enrollment, setEnrollment] = useState<CourseEnrollmentWithProgress | null>(null);

  useEffect(() => {
    // Expand module containing current lesson
    if (currentLesson && course.modules) {
      const foundModule = course.modules.find((m: CourseModule) =>
        m.lessons.some((l: CourseLesson) => l.id === currentLesson.id)
      );
      if (foundModule) {
        setExpandedModules(prev => new Set(prev).add(foundModule.id));
      }
    }

    // Fetch enrollment and progress
    fetchEnrollmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, currentLesson]);

  const fetchEnrollmentData = async () => {
    try {
      const response = await fetch(`/api/courses/${course.id}`);
      if (response.ok) {
        const data: EnrollmentResponse = await response.json();
        const userEnrollment = data.enrollments?.find(e => e.userId === userId);
        setEnrollment(userEnrollment || null);
      }
    } catch (error) {
      console.error('Error fetching enrollment:', error);
    }
  };

  const toggleModule = (courseModuleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(courseModuleId)) {
        next.delete(courseModuleId);
      } else {
        next.add(courseModuleId);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="w-96 bg-[#141414] border-r border-[#2a2a2a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <h2 className="text-white font-medium text-lg mb-2">Course Content</h2>
        <ProgressTracker
          currentProgress={enrollment?.progressPercent || 0}
          totalLessons={course.lessonCount || course.modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0}
        />
      </div>

      {/* Module List */}
      <div className="flex-1 overflow-y-auto">
        {course.modules?.map((courseModule: CourseModule, courseModuleIdx: number) => {
          const isExpanded = expandedModules.has(courseModule.id);
          const completedLessons = 0; // TODO: Calculate from lesson progress

          return (
            <div key={courseModule.id} className="border-b border-[#2a2a2a]">
              {/* Module Header */}
              <button
                onClick={() => toggleModule(courseModule.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors text-left"
              >
                <div className="flex-1">
                  <div className="text-white font-medium mb-1">
                    {courseModuleIdx + 1}. {courseModule.title}
                  </div>
                  <div className="text-xs text-[#a0a0a0]">
                    {completedLessons}/{courseModule.lessons.length} lessons
                  </div>
                </div>

                <svg
                  className={`w-5 h-5 text-[#a0a0a0] transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Lesson List */}
              {isExpanded && (
                <div className="bg-[#0a0a0a]">
                  {courseModule.lessons.map((lesson: CourseLesson, lessonIdx: number) => {
                    const isActive = currentLesson?.id === lesson.id;
                    const isCompleted = false; // TODO: Check from progress

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onLessonSelect(lesson)}
                        className={`w-full p-4 pl-8 flex items-center gap-3 hover:bg-[#141414] transition-colors text-left ${
                          isActive ? 'bg-[#141414] border-l-2 border-[#00D9FF]' : ''
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : isActive ? (
                            <div className="w-6 h-6 rounded-full bg-[#00D9FF] flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-[#2a2a2a] flex items-center justify-center">
                              <span className="text-xs text-[#a0a0a0]">{lessonIdx + 1}</span>
                            </div>
                          )}
                        </div>

                        {/* Lesson Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate ${
                            isActive ? 'text-[#00D9FF] font-medium' : 'text-white'
                          }`}>
                            {lesson.title}
                          </div>
                          {lesson.videoDuration && (
                            <div className="text-xs text-[#a0a0a0] mt-1">
                              {formatDuration(lesson.videoDuration)}
                            </div>
                          )}
                        </div>

                        {/* Video Icon */}
                        {lesson.videoUrl && (
                          <svg className="w-4 h-4 text-[#a0a0a0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - Certificate */}
      {enrollment?.isCompleted && (
        <div className="p-4 border-t border-[#2a2a2a] bg-gradient-to-r from-[#00D9FF]/10 to-[#a855f7]/10">
          <button className="w-full py-3 px-4 bg-gradient-to-r from-[#00D9FF] to-[#a855f7] text-white font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Get Certificate
          </button>
        </div>
      )}
    </div>
  );
}
