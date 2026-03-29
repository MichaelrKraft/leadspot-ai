// Course type definitions for components

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  lessons: CourseLesson[];
}

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  videoDuration: number | null;
  order: number;
}

export interface CourseProgress {
  enrollmentId: string;
  courseId: string;
  userId: string;
  progressPercent: number;
  isCompleted: boolean;
  enrolledAt: Date;
  completedAt: Date | null;
}

export interface LessonProgress {
  id: string;
  enrollmentId: string;
  lessonId: string;
  userId: string;
  isCompleted: boolean;
  watchedSeconds: number;
  completedAt: Date | null;
}

export interface Course {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  instructorId: string;
  level: string;
  price: number;
  isFree: boolean;
  isPublished: boolean;
  coverImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  totalDuration?: number; // Total duration in seconds
  lessonCount?: number; // Total number of lessons
  instructor?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  modules?: CourseModule[];
  _count?: {
    enrollments: number;
  };
}

export interface CourseEnrollmentWithProgress {
  enrollmentId: string;
  progressPercent: number;
  isCompleted: boolean;
  lessonProgress: Record<string, LessonProgress>;
}
