#!/bin/bash

# Fix reactions route
sed -i '' 's/reaction: any/reaction: { reactionType: string; _count: { reactionType: number } }/g' src/app/api/posts/[id]/reactions/route.ts

# Fix posts/[id]/route.ts - updateData
sed -i '' 's/const updateData: any = {};/interface UpdateData { title?: string; content?: string; type?: string; isPinned?: boolean; } const updateData: UpdateData = {};/' src/app/api/posts/[id]/route.ts

# Fix posts/[id]/route.ts - reaction reduce
sed -i '' '231s/any/{ reactionType: string; _count: { reactionType: number } }/' src/app/api/posts/[id]/route.ts

# Fix course pages with any types
sed -i '' 's/params: any/params: { slug: string; courseId: string; lessonId: string }/' src/app/community/[slug]/courses/[courseId]/learn/page.tsx
sed -i '' 's/: any) =/: { slug: string; courseId: string; lessonId: string }) =>/' src/app/community/[slug]/courses/[courseId]/learn/page.tsx
sed -i '' 's/res: any/res: Response/' src/app/community/[slug]/courses/[courseId]/learn/page.tsx

# Fix course details page
sed -i '' 's/enrollment: any/enrollment: { enrollmentId: string; progressPercent: number; isCompleted: boolean } | null/' src/app/community/[slug]/courses/[courseId]/page.tsx

# Fix types/api.ts
sed -i '' 's/\[key: string\]: any;/\[key: string\]: unknown;/' src/types/api.ts

# Fix ProgressTracker unused var
sed -i '' 's/, totalLessons/\/\/ totalLessons/' src/components/courses/ProgressTracker.tsx

echo "API type fixes applied"
