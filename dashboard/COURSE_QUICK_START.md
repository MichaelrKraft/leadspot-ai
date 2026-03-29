# Course System - Quick Start Guide

## Getting Started in 5 Minutes

### 1. Database Setup

The Prisma schema already includes all course models. Just sync your database:

```bash
npx prisma generate
npx prisma db push
```

### 2. Seed Sample Data

Populate your database with sample courses:

```bash
npx tsx prisma/seed-courses.ts
```

This creates:
- 1 community: "Marketing Masters"
- 2 users: instructor@mautic.com, student@mautic.com
- 3 courses: Beginner, Intermediate, Advanced
- Multiple modules and lessons with video links
- Sample enrollment and progress data

### 3. Start Development Server

```bash
npm run dev
```

### 4. Browse Courses

Open your browser to:
```
http://localhost:3000/community/marketing-masters/courses
```

You should see 3 courses displayed in the catalog.

### 5. Test Course Player

Click on "Introduction to Marketing Automation" → Click "Enroll Now"

You'll be taken to the course player where you can:
- Watch video lessons (uses sample videos from Google)
- Navigate between lessons
- See your progress update in real-time

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── courses/
│   │   │   ├── route.ts                    # List/create courses
│   │   │   └── [id]/
│   │   │       ├── route.ts                # Get/update/delete course
│   │   │       ├── enroll/
│   │   │       │   └── route.ts            # Enroll user
│   │   │       └── lessons/
│   │   │           └── [lessonId]/
│   │   │               └── route.ts        # Get lesson
│   │   └── lessons/
│   │       └── [id]/
│   │           └── progress/
│   │               └── route.ts            # Update progress
│   └── community/
│       └── [slug]/
│           └── courses/
│               ├── page.tsx                # Course catalog
│               └── [courseId]/
│                   ├── page.tsx            # Course details
│                   └── learn/
│                       └── page.tsx        # Course player
└── components/
    └── courses/
        ├── CourseCatalog.tsx               # Browse/search
        ├── CourseCard.tsx                  # Course preview
        ├── CoursePlayer.tsx                # Video player
        ├── CourseSidebar.tsx               # Navigation
        ├── ProgressTracker.tsx             # Progress bar
        └── CourseBuilder.tsx               # Admin tool
```

## Key Features to Test

### As a Student

1. **Browse Courses**
   - Go to `/community/marketing-masters/courses`
   - Use search to find "automation"
   - Filter by "beginner" level
   - Toggle between grid and list view

2. **Enroll in Course**
   - Click "Introduction to Marketing Automation"
   - Click "Enroll Now" button
   - Watch points increase (+10 points)

3. **Watch Lessons**
   - Video auto-plays with controls
   - Progress saves every 5 seconds
   - Navigate to next lesson via sidebar
   - Complete lesson at 90% watched (+25 points)

4. **Track Progress**
   - See progress bar in sidebar
   - Check percentage completion
   - View completed lessons (green checkmark)

### As an Instructor/Admin

1. **Create Course**
   - Import `CourseBuilder` component
   - Fill in course details
   - Add modules and lessons
   - Set pricing and publish

Example page:
```tsx
import CourseBuilder from '@/components/courses/CourseBuilder';

export default function AdminCoursesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <CourseBuilder
        communityId="your-community-id"
        instructorId="your-user-id"
        onCourseCreated={(course) => {
          console.log('Created:', course);
          // Redirect or show success
        }}
      />
    </div>
  );
}
```

## Testing Checklist

- [ ] Course catalog loads
- [ ] Search finds courses
- [ ] Filter by level works
- [ ] Course details page shows curriculum
- [ ] Enroll button creates enrollment
- [ ] Video player loads and plays
- [ ] Progress saves automatically
- [ ] Sidebar shows completion status
- [ ] Points awarded correctly
- [ ] Certificate button appears when 100% complete

## Troubleshooting

### Videos Not Playing?
The seed script uses sample videos from Google's public CDN. If they don't play:
1. Check browser console for CORS errors
2. Try a different browser
3. Replace with your own video URLs

### Progress Not Saving?
1. Open browser DevTools → Network tab
2. Watch for POST requests to `/api/lessons/[id]/progress`
3. Check response for errors
4. Verify database connection

### Enrollment Fails?
1. Check that user exists in database
2. Verify community membership
3. Look for duplicate enrollment errors
4. Check API logs for details

## Next Steps

1. **Customize Design**: Update colors in components to match your brand
2. **Add Authentication**: Implement real user auth (JWT, NextAuth, etc.)
3. **Configure Video Hosting**: Use Cloudflare Stream, AWS CloudFront, or similar
4. **Enable Certificates**: Implement PDF generation for completed courses
5. **Add Drip Scheduling**: Lock lessons until specific dates or prerequisites met

## Production Checklist

Before deploying to production:

- [ ] Replace sample videos with real content
- [ ] Implement proper authentication
- [ ] Add authorization checks (enrolled users only)
- [ ] Set up CDN for video hosting
- [ ] Enable database backups
- [ ] Add error tracking (Sentry, LogRocket)
- [ ] Implement rate limiting on API routes
- [ ] Add analytics tracking
- [ ] Test on mobile devices
- [ ] Optimize video loading (lazy load, preconnect)

## Sample Data Details

### Test Accounts
- **Instructor**: instructor@mautic.com
- **Student**: student@mautic.com

### Sample Courses
1. **Introduction to Marketing Automation** (Beginner)
   - 2 modules, 5 lessons total
   - Student already enrolled (40% complete)

2. **Advanced Campaign Building** (Intermediate)
   - 1 module, 2 lessons
   - Not enrolled

3. **Mautic API & Integration Mastery** (Advanced)
   - 1 module, 3 lessons
   - Not enrolled

### Video Sources
Sample videos from: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/
- BigBuckBunny.mp4 (9:56)
- ElephantsDream.mp4 (10:53)
- ForBiggerBlazes.mp4, etc.

## Support Resources

- **Full Documentation**: See `COURSE_SYSTEM_README.md`
- **API Reference**: Check individual route files for parameters
- **Database Schema**: `/prisma/schema.prisma`
- **Design System**: Mautic dark theme (see README)

## Common Customizations

### Change Completion Threshold
Edit `src/app/api/lessons/[id]/progress/route.ts`:
```typescript
// Line ~60
const isCompleted = videoDuration > 0 && watchedSeconds >= videoDuration * 0.9;
// Change 0.9 to 0.8 for 80% completion
```

### Adjust Points
Edit the same file:
```typescript
// Lesson completion points (line ~75)
points: 25, // Change to your desired value

// Course completion points (line ~130)
points: 100, // Change to your desired value
```

### Modify Auto-Save Interval
Edit `src/components/courses/CoursePlayer.tsx`:
```typescript
// Line ~60
progressUpdateInterval.current = setInterval(() => {
  // ...
}, 5000); // Change 5000 to desired milliseconds
```

## Happy Course Building! 🎓

For more help, see the comprehensive README or check the inline comments in the code.
