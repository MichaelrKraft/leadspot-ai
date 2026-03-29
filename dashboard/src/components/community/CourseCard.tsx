'use client';

import Link from 'next/link';
import Image from 'next/image';

interface Course {
  id: string;
  title: string;
  description: string | null;
  instructor: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  level: string;
  isFree: boolean;
  price: number;
  coverImage: string | null;
  moduleCount: number;
  lessonCount: number;
  totalDuration: number; // in seconds
  enrollmentCount: number;
}

interface CourseCardProps {
  course: Course;
  communitySlug: string;
}

export default function CourseCard({ course, communitySlug }: CourseCardProps) {
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

  return (
    <Link
      href={`/community/${communitySlug}/courses/${course.id}`}
      className="block bg-bg-secondary rounded-xl border border-border-subtle hover:border-accent-cyan transition-all duration-200 overflow-hidden group"
    >
      {/* Cover Image */}
      <div className="relative h-48 bg-bg-tertiary overflow-hidden">
        {course.coverImage ? (
          <Image
            src={course.coverImage}
            alt={course.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20">
            <svg className="w-16 h-16 text-accent-cyan/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}

        {/* Price Badge */}
        {course.isFree ? (
          <div className="absolute top-4 right-4 px-3 py-1 bg-accent-green text-white text-sm font-semibold rounded-full">
            FREE
          </div>
        ) : (
          <div className="absolute top-4 right-4 px-3 py-1 bg-bg-primary/90 backdrop-blur-sm text-text-primary text-sm font-semibold rounded-full border border-border-subtle">
            ${course.price}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Level Badge */}
        <div className="mb-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(course.level)}`}>
            {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2 group-hover:text-accent-cyan transition-colors">
          {course.title}
        </h3>

        {/* Description */}
        {course.description && (
          <p className="text-text-secondary text-sm mb-4 line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Instructor */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan text-xs font-semibold">
            {course.instructor.avatar || course.instructor.name?.charAt(0) || 'I'}
          </div>
          <span className="text-text-secondary text-sm">
            {course.instructor.name || 'Anonymous'}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-4 border-t border-border-subtle text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>{course.lessonCount} lessons</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDuration(course.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>{course.enrollmentCount} enrolled</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
