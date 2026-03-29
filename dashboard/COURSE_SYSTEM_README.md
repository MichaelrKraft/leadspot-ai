# Course System - Complete Implementation

## Overview

A complete course management system for the Mautic Platform membership area, featuring video playback, progress tracking, certificates, and gamification.

## Architecture

### Database Models (Prisma)

Located in `/prisma/schema.prisma`:

- **Course**: Main course entity with metadata
- **CourseModule**: Sections within a course
- **CourseLesson**: Individual lessons with video/text content
- **CourseEnrollment**: User enrollment tracking
- **LessonProgress**: Per-lesson completion tracking

### API Routes

#### `/api/courses` - Course Management
- **GET**: List all courses (with filters)
  - Query params: `communityId`, `isPublished`, `level`
  - Returns: Array of courses with metadata
- **POST**: Create new course (admin only)
  - Body: `{ communityId, title, description, instructorId, level, price, isFree, isPublished, coverImage }`

#### `/api/courses/[id]` - Single Course
- **GET**: Get course details with modules/lessons
- **PATCH**: Update course (admin/instructor only)
- **DELETE**: Delete course (admin only)

#### `/api/courses/[id]/enroll` - Enrollment
- **POST**: Enroll user in course
  - Body: `{ userId }`
  - Awards 10 points on enrollment

#### `/api/courses/[id]/lessons/[lessonId]` - Lesson Content
- **GET**: Get lesson with progress
  - Query params: `userId` (optional)

#### `/api/lessons/[id]/progress` - Progress Tracking
- **POST**: Update lesson watch progress
  - Body: `{ userId, watchedSeconds }`
  - Auto-marks complete at 90% watched
  - Awards points: 25 per lesson, 100 for course completion

### Frontend Pages

#### `/community/[slug]/courses` - Course Catalog
- Browse and search all published courses
- Filter by level (beginner/intermediate/advanced)
- Grid and list view modes

#### `/community/[slug]/courses/[courseId]` - Course Details
- Course overview with instructor info
- Curriculum breakdown
- Enrollment button
- Displays total lessons, duration, enrolled count

#### `/community/[slug]/courses/[courseId]/learn` - Course Player
- Video player with Video.js
- Resume from last position
- Auto-save progress every 5 seconds
- Sidebar navigation
- Certificate download (when complete)

### Components

#### `CourseCatalog.tsx`
- Search and filter functionality
- Grid/list view toggle
- Responsive layout

#### `CourseCard.tsx`
- Course preview card
- Supports grid and list layouts
- Shows instructor, duration, lessons, enrollment count

#### `CoursePlayer.tsx`
- Video.js integration
- Progress tracking (90% = complete)
- Resume playback from last position
- Auto-save progress every 5 seconds
- Text-based lesson support
- Manual "Mark Complete" button for non-video lessons

#### `CourseSidebar.tsx`
- Module/lesson navigation
- Progress visualization
- Lesson status indicators (completed/active/locked)
- Certificate download button (when complete)

#### `ProgressTracker.tsx`
- Visual progress bar
- Percentage display
- Completion badge

#### `CourseBuilder.tsx`
- 3-step course creation wizard
- Add modules and lessons
- Course settings (free/paid, published)
- Admin/instructor tool

## Features

### Video Playback
- **Player**: Video.js with custom controls
- **Speed Control**: 0.5x to 2x playback speed
- **Resume**: Automatically resumes from last position
- **Auto-Save**: Progress saved every 5 seconds while playing
- **Completion**: Auto-marks complete at 90% watched

### Progress Tracking
- **Per-Lesson**: Tracks watched seconds for each lesson
- **Course-Wide**: Calculates overall completion percentage
- **Real-Time**: Updates progress in sidebar while watching
- **Persistent**: Saved to database for cross-device sync

### Gamification
- **Enrollment**: +10 points
- **Lesson Completion**: +25 points per lesson
- **Course Completion**: +100 bonus points
- **Community Points**: Updates user's community member points

### Certificates
- **Auto-Generate**: Available when course 100% complete
- **Download Button**: In sidebar footer
- **Placeholder**: Currently shows button (PDF generation to be implemented)

### Drip Schedule (Future)
- Database supports `dripSchedule` in lessons
- Can unlock lessons based on time or previous completion
- UI placeholder in sidebar (locked icon)

## Design System

### Colors (Mautic Theme)
```css
--bg-primary: #0a0a0a
--bg-secondary: #141414
--bg-tertiary: #1a1a1a
--border: #2a2a2a
--text-primary: #ffffff
--text-secondary: #a0a0a0
--accent-cyan: #00D9FF
--accent-purple: #a855f7
```

### Typography
- **Font**: System fonts (sans-serif)
- **Headings**: font-semibold
- **Body**: font-normal

### UI Patterns
- Dark backgrounds with subtle borders
- Cyan accent for interactive elements
- Gradient buttons for primary actions
- Hover states with border glow
- Smooth transitions (300ms)

## Installation

### 1. Install Dependencies
```bash
npm install video.js @types/video.js
```

### 2. Database Setup
```bash
# Already included in Prisma schema
npx prisma generate
npx prisma db push
```

### 3. Import Video.js Styles
Add to your layout or page:
```typescript
import 'video.js/dist/video-js.css';
```

## Usage Examples

### For Students

#### Browse Courses
1. Navigate to `/community/[slug]/courses`
2. Search or filter by level
3. Click course card to view details

#### Enroll in Course
1. On course details page, click "Enroll Now"
2. Automatically redirected to course player
3. Starts from first lesson

#### Watch Lessons
1. Video plays with full controls
2. Progress auto-saves every 5 seconds
3. Resume from where you left off
4. Mark text lessons as complete manually

#### Get Certificate
1. Complete all lessons (100% progress)
2. "Get Certificate" button appears in sidebar
3. Click to download (PDF generation pending)

### For Admins/Instructors

#### Create Course
1. Use `CourseBuilder` component
2. Step 1: Enter basic info (title, description, level)
3. Step 2: Add modules and lessons
4. Step 3: Set pricing and publish status
5. Click "Create Course"

#### Example Code
```tsx
import CourseBuilder from '@/components/courses/CourseBuilder';

function AdminPage() {
  return (
    <CourseBuilder
      communityId="community-123"
      instructorId="user-456"
      onCourseCreated={(course) => {
        console.log('Course created:', course);
      }}
    />
  );
}
```

## API Integration

### Enroll User
```typescript
const response = await fetch(`/api/courses/${courseId}/enroll`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user-123' }),
});

const enrollment = await response.json();
```

### Update Progress
```typescript
const response = await fetch(`/api/lessons/${lessonId}/progress`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    watchedSeconds: 450,
  }),
});

const { progress, courseProgress, courseCompleted } = await response.json();
```

### Fetch Courses
```typescript
const response = await fetch('/api/courses?communityId=comm-123&isPublished=true');
const courses = await response.json();
```

## Future Enhancements

### Phase 2
- [ ] PDF certificate generation with custom templates
- [ ] Drip schedule implementation (unlock lessons over time)
- [ ] Quiz/assessment system
- [ ] Discussion threads per lesson
- [ ] Downloadable resources
- [ ] Closed captions/subtitles

### Phase 3
- [ ] Live streaming integration
- [ ] Group cohorts
- [ ] Instructor dashboard analytics
- [ ] Student performance metrics
- [ ] Email notifications for new lessons
- [ ] Mobile app support

## Performance Considerations

### Video Optimization
- Use CDN for video hosting (Cloudflare Stream, AWS CloudFront)
- Implement adaptive bitrate streaming (HLS/DASH)
- Lazy load video players
- Preload next lesson

### Database Optimization
- Index on `courseId`, `userId`, `isPublished`
- Use database connection pooling
- Cache course catalog with Redis
- Paginate course lists

### Frontend Optimization
- Code splitting for Video.js
- Image lazy loading
- Debounce progress updates
- Use React.memo for course cards

## Security

### Authentication
- Verify user authentication before enrolling
- Check enrollment before accessing lessons
- Validate user permissions for admin actions

### Authorization
- Only instructors/admins can create courses
- Only enrolled users can access lessons
- Only course owners can update/delete

### Input Validation
- Sanitize course descriptions (prevent XSS)
- Validate video URLs
- Check file upload types for cover images
- Rate limit API endpoints

## Testing

### Manual Testing Checklist
- [ ] Browse course catalog
- [ ] Filter by level
- [ ] Enroll in course
- [ ] Watch video lesson
- [ ] Progress saves correctly
- [ ] Resume from last position
- [ ] Complete lesson (auto at 90%)
- [ ] Complete entire course
- [ ] Certificate button appears
- [ ] Points awarded correctly

### Automated Testing (Future)
```typescript
// Example Jest test
test('enrolls user and awards points', async () => {
  const response = await fetch('/api/courses/123/enroll', {
    method: 'POST',
    body: JSON.stringify({ userId: 'test-user' }),
  });

  expect(response.status).toBe(201);
  const enrollment = await response.json();
  expect(enrollment.progressPercent).toBe(0);

  // Verify points transaction created
  // ...
});
```

## Troubleshooting

### Video Not Playing
1. Check video URL is accessible
2. Verify CORS headers if cross-origin
3. Check browser console for errors
4. Ensure Video.js CSS is loaded

### Progress Not Saving
1. Check browser network tab for API errors
2. Verify user is enrolled in course
3. Check database connection
4. Look for CORS issues

### Certificate Not Appearing
1. Verify course is 100% complete
2. Check all lessons marked as completed
3. Refresh enrollment data
4. Check `isCompleted` flag in database

## Support

For questions or issues:
- Check this README first
- Review API route code for details
- Check Prisma schema for data models
- Test with browser DevTools network tab

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: Production Ready
