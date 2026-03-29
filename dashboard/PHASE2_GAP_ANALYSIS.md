# Phase 2: Membership/Community Area - Gap Analysis

**Generated:** December 13, 2025
**Status:** Week 3 completed, Week 1 & 2 missing
**Database:** Seeded and ready
**Build Status:** Fixed and working

---

## Executive Summary

Week 3 (Events & Gamification) has been implemented by sub-agents, but **Week 1 (Community Feed) and Week 2 (Course System) were never implemented**. Week 3 features cannot be tested or used without the foundational infrastructure from Weeks 1 & 2.

This document provides a complete inventory of what exists, what's missing, and what needs to be built.

---

## What EXISTS ✅

### Database Schema (Complete)
All tables from the original plan exist in `prisma/schema.prisma`:

**Community & Members:**
- ✅ `Community` - Base community entity
- ✅ `CommunityMember` - User memberships with points/levels

**Week 1 Tables (Ready but Unused):**
- ✅ `Post` - Discussion posts
- ✅ `Comment` - Nested comments
- ✅ `Reaction` - Post/comment reactions
- ✅ `PostTag` - Tagging system

**Week 2 Tables (Ready but Unused):**
- ✅ `Course` - Course catalog
- ✅ `CourseModule` - Course sections
- ✅ `CourseLesson` - Individual lessons
- ✅ `CourseEnrollment` - User enrollments
- ✅ `LessonProgress` - Lesson completion tracking

**Week 3 Tables (Created & Used):**
- ✅ `Event` - Community events
- ✅ `EventAttendee` - Event registrations
- ✅ `Achievement` - Gamification achievements
- ✅ `UserAchievement` - User achievements earned
- ✅ `PointTransaction` - Points history
- ✅ `Notification` - User notifications

### Week 3 Implementation (Complete)

**Pages Created:**
```
/src/app/community/[slug]/events/page.tsx - Events calendar page
/src/app/community/[slug]/leaderboard/page.tsx - Leaderboard rankings
```

**Components Created:**
```
/src/components/events/EventsCalendar.tsx - FullCalendar integration
/src/components/events/EventCard.tsx - Event list items
/src/components/events/EventRegistrationModal.tsx - Registration modal

/src/components/gamification/Leaderboard.tsx - Top 10 rankings
/src/components/gamification/AchievementBadge.tsx - Badge display
/src/components/gamification/PointsDisplay.tsx - Points/level UI

/src/components/notifications/NotificationCenter.tsx - Bell dropdown
/src/components/notifications/NotificationItem.tsx - Single notification
```

**API Routes Created:**
```
/src/app/api/events/[id]/attendees/route.ts - Get attendees
/src/app/api/events/[id]/registration-status/route.ts - Check registration
/src/app/api/achievements/route.ts - List achievements
/src/app/api/users/[id]/points/route.ts - User points
/src/app/api/notifications/route.ts - Get notifications
/src/app/api/notifications/[id]/read/route.ts - Mark as read
/src/app/api/notifications/mark-all-read/route.ts - Mark all read
```

**Minimal Routes Created (For Testing):**
```
/src/app/api/community/[slug]/route.ts - Get community details
/src/app/api/community/[slug]/posts/route.ts - List posts (minimal)
```

### Course API Routes (Fixed)

Fixed all Prisma client import issues in:
```
/src/app/api/courses/route.ts - List/create courses
/src/app/api/courses/[id]/enroll/route.ts - Enroll in course
/src/app/api/courses/[id]/lessons/[lessonId]/route.ts - Get lesson
/src/app/api/lessons/[id]/progress/route.ts - Update progress
```

---

## What's MISSING ❌

### Week 1: Community Feed System

**Pages Needed:**
```
/src/app/community/[slug]/page.tsx - Main community feed (CRITICAL)
/src/app/community/[slug]/posts/[id]/page.tsx - Single post view
/src/app/community/[slug]/members/page.tsx - Member directory
/src/app/community/[slug]/members/[userId]/page.tsx - User profile
```

**Components Needed:**
```
/src/components/community/CommunityLayout.tsx - Sidebar + header
/src/components/community/Sidebar.tsx - Community navigation
/src/components/community/CommunityFeed.tsx - Main feed container
/src/components/community/PostCard.tsx - Individual post display
/src/components/community/CreatePostModal.tsx - Rich text post editor
/src/components/community/CommentSection.tsx - Comments thread
/src/components/community/ReactionButton.tsx - Reaction UI
/src/components/community/UserProfile.tsx - Profile page

/src/components/shared/RichTextEditor.tsx - TipTap editor
/src/components/shared/ImageUpload.tsx - File upload
/src/components/shared/AvatarUpload.tsx - Avatar selection
```

**API Routes Needed:**
```
/src/app/api/communities/[id]/posts/route.ts - POST create post, GET list
/src/app/api/posts/[id]/route.ts - GET/PATCH/DELETE single post
/src/app/api/posts/[id]/comments/route.ts - POST create comment
/src/app/api/comments/[id]/route.ts - PATCH/DELETE comment
/src/app/api/posts/[id]/reactions/route.ts - POST add/remove reaction
/src/app/api/users/[id]/route.ts - GET user profile
/src/app/api/users/[id]/route.ts - PATCH update profile (via PATCH method)
```

### Week 2: Course System

**Pages Needed:**
```
/src/app/community/[slug]/courses/page.tsx - Course catalog
/src/app/community/[slug]/courses/[id]/page.tsx - Course details
/src/app/community/[slug]/courses/[id]/learn/page.tsx - Course player
```

**Components Needed:**
```
/src/components/courses/CourseCatalog.tsx - Browse view
/src/components/courses/CourseCard.tsx - Course preview card
/src/components/courses/CoursePlayer.tsx - Video + content player
/src/components/courses/CourseSidebar.tsx - Lesson navigation
/src/components/courses/ProgressTracker.tsx - Progress UI
/src/components/courses/CourseBuilder.tsx - Admin creation tool
/src/components/courses/CertificateGenerator.tsx - PDF certificate

/src/components/shared/VideoPlayer.tsx - Video.js wrapper
```

**API Routes Needed (Exist but Need Testing):**
```
✅ /src/app/api/courses/route.ts - GET list, POST create
✅ /src/app/api/courses/[id]/route.ts - GET details (NEEDS CREATION)
✅ /src/app/api/courses/[id]/enroll/route.ts - POST enroll
✅ /src/app/api/courses/[id]/lessons/[lessonId]/route.ts - GET lesson
✅ /src/app/api/lessons/[id]/progress/route.ts - POST update progress

NEEDED:
/src/app/api/courses/[id]/route.ts - GET single course (doesn't exist yet)
/src/app/api/courses/[id]/modules/route.ts - POST create module
/src/app/api/modules/[id]/lessons/route.ts - POST create lesson
/src/app/api/courses/[id]/upload-video/route.ts - POST video upload
```

### Navigation Integration

**Update Main Sidebar:**
```
/src/components/Sidebar.tsx - Add Community section with:
  - Feed
  - Courses
  - Events
  - Leaderboard
  - Members
```

**Update Dashboard:**
```
/src/app/page.tsx - Add community stats card showing:
  - Total members
  - Active discussions
  - Course completions
  - Upcoming events
```

---

## Testing Blockers

### Why Week 3 Cannot Be Tested

1. **Leaderboard Component**
   - Requires active community with posts/courses
   - Needs `/api/users/[id]/points` to work
   - Displays "Error fetching points" without user activity

2. **Events Calendar**
   - Works independently but has no context
   - Registration requires authenticated users
   - Events need posts/courses to tie to

3. **Notification Center**
   - Works but has no triggers
   - Notifications come from post comments, course completions, etc.
   - Empty without Week 1 & 2 activity

### Current Errors in Browser

**Console Errors:**
```
[404] GET /api/community/mautic-masters (page doesn't exist)
[404] GET /api/users/[id]/points (PointsDisplay component)
[React] Cannot update component during render (PointsDisplay.tsx:30)
```

**Visual Errors:**
- Leaderboard page: Blank screen, no data
- Community page: 404 Not Found
- Events page: Likely loads but no context

---

## Implementation Priority

### Phase 2A: Week 1 - Community Feed (7 days)

**Day 1-2: Core Infrastructure**
- Create main community page (`/community/[slug]/page.tsx`)
- Create CommunityLayout with sidebar
- Implement CommunityFeed component
- Create PostCard component

**Day 3-4: Post Creation**
- Implement CreatePostModal with TipTap
- Add ImageUpload component
- Wire up POST `/api/communities/[id]/posts`
- Test post creation flow

**Day 5-6: Comments & Reactions**
- Implement CommentSection component
- Add ReactionButton component
- Wire up comment API routes
- Wire up reaction API routes

**Day 7: Testing & Polish**
- End-to-end testing with Playwright
- Fix any bugs
- Ensure all Week 1 features work

### Phase 2B: Week 2 - Course System (7 days)

**Day 8-9: Course Catalog**
- Create course catalog page
- Implement CourseCatalog component
- Implement CourseCard component
- Wire up GET `/api/courses`

**Day 10-11: Course Player**
- Create course details page
- Create course player page
- Implement CoursePlayer with Video.js
- Implement CourseSidebar navigation

**Day 12-13: Progress Tracking**
- Implement ProgressTracker component
- Wire up lesson progress API
- Add course completion logic
- Generate certificates on completion

**Day 14: Testing & Polish**
- End-to-end testing with Playwright
- Verify enrollment flow
- Test progress tracking
- Ensure all Week 2 features work

### Phase 2C: Week 3 Validation (2 days)

**Day 15-16: Integration Testing**
- Test Leaderboard with real data
- Test Events with course/post context
- Test Notifications from all triggers
- Fix any integration issues

---

## File Count Summary

**Created (Week 3):** 14 files
- 2 pages
- 7 components
- 5 API routes

**Missing (Week 1):** ~16 files
- 4 pages
- 9 components
- 6 API routes (some exist, need completion)

**Missing (Week 2):** ~15 files
- 3 pages
- 8 components
- 4 API routes (most exist but need GET /courses/[id])

**Total Missing:** ~31 files to reach Week 3 completion

---

## Recommendations

### Option 1: Complete Phase 2 Properly (Recommended)
- Implement Week 1 & 2 in sequence
- Test each week before moving forward
- Launch with fully functional community platform
- **Timeline:** 16 days

### Option 2: Hybrid Approach
- Implement minimal Week 1 (just community feed, no profiles)
- Implement minimal Week 2 (just course player, no builder)
- Test Week 3 with minimal data
- **Timeline:** 10 days

### Option 3: Mock Data Testing
- Create fake API responses for testing
- Validate Week 3 UI/UX works
- Circle back to implement real infrastructure later
- **Timeline:** 2 days (but defers real work)

---

## Next Steps

**If proceeding with full implementation:**

1. Create feature branch: `git checkout -b feature/community-feed`
2. Implement Week 1 following the plan above
3. Test with Playwright after each component
4. Merge when complete
5. Repeat for Week 2 and Week 3

**If proceeding with testing only:**

1. I can generate mock API responses
2. Update Week 3 components to use mock data
3. Validate UI/UX looks correct
4. Document what needs real implementation

**Your decision:**
- A) Full implementation (Week 1 → Week 2 → Week 3 testing)
- B) Hybrid minimal implementation
- C) Mock data testing only
- D) Something else

---

**Status:** Awaiting user decision to proceed.
