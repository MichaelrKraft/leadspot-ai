#!/bin/bash

# Update CourseBuilder.tsx
sed -i '' 's/: any;/: CourseModule;/g' src/components/courses/CourseBuilder.tsx
sed -i '' 's/: any\[/: CourseModule[/g' src/components/courses/CourseBuilder.tsx
sed -i '' 's/: any)/: CourseModule)/g' src/components/courses/CourseBuilder.tsx
sed -i '' "1s/^/import { CourseModule, CourseLesson } from '@\/types\/course';\n/" src/components/courses/CourseBuilder.tsx

# Update Course Card.tsx
sed -i '' 's/course: any/course: Course/g' src/components/courses/CourseCard.tsx
sed -i '' "1s/^/import { Course } from '@\/types\/course';\n/" src/components/courses/CourseCard.tsx

# Update CourseCatalog.tsx
sed -i '' 's/courses: any/courses: Course/g' src/components/courses/CourseCatalog.tsx
sed -i '' "1s/^/import { Course } from '@\/types\/course';\n/" src/components/courses/CourseCatalog.tsx

# Update CoursePlayer.tsx
sed -i '' 's/lesson: any/lesson: CourseLesson/g' src/components/courses/CoursePlayer.tsx
sed -i '' 's/progress: any/progress: LessonProgress | null/g' src/components/courses/CoursePlayer.tsx
sed -i '' "1s/^/import { CourseLesson, LessonProgress } from '@\/types\/course';\n/" src/components/courses/CoursePlayer.tsx

# Update CourseSidebar.tsx
sed -i '' 's/course: any/course: Course/g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/modules: any/modules: CourseModule/g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/currentLesson: any/currentLesson: CourseLesson | null/g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/lessonProgress: any/lessonProgress: Record<string, LessonProgress>/g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/enrollment: any/enrollment: CourseEnrollmentWithProgress/g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/setLessonProgress/\/\/ setLessonProgress/g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/lessonProgress, /\/\/ lessonProgress, /g' src/components/courses/CourseSidebar.tsx
sed -i '' 's/module/courseModule/g' src/components/courses/CourseSidebar.tsx
sed -i '' "1s/^/import { Course, CourseModule, CourseLesson, LessonProgress, CourseEnrollmentWithProgress } from '@\/types\/course';\n/" src/components/courses/CourseSidebar.tsx

echo "Component type fixes applied"
