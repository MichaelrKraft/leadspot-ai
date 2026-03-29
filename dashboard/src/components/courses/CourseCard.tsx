'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Course } from '@/types/course';

interface CourseCardProps {
  course: Course;
  communitySlug: string;
  viewMode?: 'grid' | 'list';
}

export default function CourseCard({ course, communitySlug, viewMode = 'grid' }: CourseCardProps) {
  // Calculate total lessons from modules
  const totalLessons = course.modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0;

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
        return 'text-green-400 border-green-400/30 bg-green-400/10';
      case 'intermediate':
        return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
      case 'advanced':
        return 'text-red-400 border-red-400/30 bg-red-400/10';
      default:
        return 'text-[#00D9FF] border-[#00D9FF]/30 bg-[#00D9FF]/10';
    }
  };

  if (viewMode === 'list') {
    return (
      <Link href={`/community/${communitySlug}/courses/${course.id}`}>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 hover:border-[#00D9FF] transition-all group">
          <div className="flex gap-6">
            {/* Thumbnail */}
            <div className="flex-shrink-0 w-48 h-32 bg-gradient-to-br from-[#00D9FF]/20 to-[#a855f7]/20 rounded-lg overflow-hidden relative">
              {course.coverImage ? (
                <Image
                  src={course.coverImage}
                  alt={course.title}
                  fill
                  className="object-cover"
                  sizes="192px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-[#00D9FF]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium border mb-2 ${getLevelColor(course.level)}`}>
                    {course.level}
                  </div>
                  <h3 className="text-xl font-semibold text-white group-hover:text-[#00D9FF] transition-colors">
                    {course.title}
                  </h3>
                </div>
              </div>

              <p className="text-[#a0a0a0] text-sm mb-4 line-clamp-2">
                {course.description}
              </p>

              <div className="flex items-center gap-6 text-sm text-[#a0a0a0]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{course.instructor?.name || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>{totalLessons} lessons</span>
                </div>
                {course.totalDuration && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatDuration(course.totalDuration)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>{course._count?.enrollments || 0} enrolled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/community/${communitySlug}/courses/${course.id}`}>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#00D9FF] transition-all group h-full flex flex-col">
        {/* Thumbnail */}
        <div className="relative w-full h-48 bg-gradient-to-br from-[#00D9FF]/20 to-[#a855f7]/20">
          {course.coverImage ? (
            <Image
              src={course.coverImage}
              alt={course.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-[#00D9FF]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}

          {/* Level Badge */}
          <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(course.level)}`}>
            {course.level}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#00D9FF] transition-colors">
            {course.title}
          </h3>

          <p className="text-[#a0a0a0] text-sm mb-4 line-clamp-2 flex-1">
            {course.description}
          </p>

          {/* Meta Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[#a0a0a0]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{course.instructor?.name || 'Unknown'}</span>
            </div>

            <div className="flex items-center justify-between text-sm text-[#a0a0a0]">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{totalLessons} lessons</span>
              </div>
              {course.totalDuration && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatDuration(course.totalDuration)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-[#a0a0a0] pt-2 border-t border-[#2a2a2a]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>{course._count?.enrollments || 0} students enrolled</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
