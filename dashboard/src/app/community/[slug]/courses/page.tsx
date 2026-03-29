'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CourseCard from '@/components/community/CourseCard';

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
  totalDuration: number;
  enrollmentCount: number;
}

export default function CourseCatalogPage() {
  const params = useParams();
  const communitySlug = params.slug as string;

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [freeFilter, setFreeFilter] = useState<string>('all');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query params
        const params = new URLSearchParams();
        if (levelFilter !== 'all') {
          params.append('level', levelFilter);
        }
        if (freeFilter !== 'all') {
          params.append('isFree', freeFilter === 'free' ? 'true' : 'false');
        }

        const queryString = params.toString();
        const url = `/api/community/${communitySlug}/courses${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }

        const data = await response.json();
        setCourses(data.courses || []);
      } catch (err) {
        console.error('Error fetching courses:', err);
        setError('Failed to load courses. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [communitySlug, levelFilter, freeFilter]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Courses</h1>
          <p className="text-text-secondary">
            Expand your knowledge with our expert-led courses
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 mb-8">
          <div className="flex flex-wrap gap-6">
            {/* Level Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Level
              </label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent-cyan transition-colors"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Price Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Price
              </label>
              <select
                value={freeFilter}
                onChange={(e) => setFreeFilter(e.target.value)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent-cyan transition-colors"
              >
                <option value="all">All Courses</option>
                <option value="free">Free Only</option>
                <option value="paid">Paid Only</option>
              </select>
            </div>

            {/* Results Count */}
            <div className="flex items-end">
              <div className="px-4 py-2 bg-bg-tertiary rounded-lg border border-border-subtle">
                <span className="text-text-secondary text-sm">
                  {loading ? (
                    'Loading...'
                  ) : (
                    <>
                      <span className="text-accent-cyan font-semibold">{courses.length}</span> course{courses.length !== 1 ? 's' : ''} found
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin"></div>
              <p className="text-text-secondary">Loading courses...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-accent-red mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-accent-red font-medium mb-2">Error Loading Courses</p>
            <p className="text-text-secondary text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-accent-red text-white rounded-lg hover:bg-accent-red/80 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && courses.length === 0 && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-xl font-semibold text-text-primary mb-2">No Courses Found</h3>
            <p className="text-text-secondary mb-6">
              {levelFilter !== 'all' || freeFilter !== 'all'
                ? 'Try adjusting your filters to see more courses.'
                : 'There are no courses available yet. Check back soon!'}
            </p>
            {(levelFilter !== 'all' || freeFilter !== 'all') && (
              <button
                onClick={() => {
                  setLevelFilter('all');
                  setFreeFilter('all');
                }}
                className="px-6 py-2 bg-accent-cyan text-white rounded-lg hover:bg-accent-cyan/80 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Course Grid */}
        {!loading && !error && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                communitySlug={communitySlug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
