# Phase 2: Membership/Community Area - Complete Implementation Plan

**Last Updated:** December 12, 2024
**Status:** Planning Phase
**Estimated Timeline:** 2-3 weeks for MVP

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Competitive Analysis](#competitive-analysis)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema Design](#database-schema-design)
5. [Feature Specifications](#feature-specifications)
6. [User Experience Flows](#user-experience-flows)
7. [Technical Implementation Plan](#technical-implementation-plan)
8. [Security & Privacy](#security--privacy)
9. [Scalability Considerations](#scalability-considerations)
10. [Integration with Existing Dashboard](#integration-with-existing-dashboard)
11. [Testing Strategy](#testing-strategy)
12. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Vision
Transform the Mautic Platform dashboard into a complete marketing ecosystem by adding a Skool.com/GHL-style membership area. This will enable users to:
- Build engaged communities around their brand
- Deliver premium courses and educational content
- Host events and live sessions
- Gamify user engagement with points and achievements

### Value Proposition
**For Platform Users (Agency Owners/Businesses):**
- One unified platform for CRM + Community + Courses
- Eliminate need for separate tools (Facebook Groups, Teachable, Circle)
- Increase customer lifetime value through community engagement
- Monetize knowledge with course offerings

**For End Users (Community Members):**
- Single place to connect, learn, and engage
- Earn recognition through gamification
- Access exclusive content and events
- Network with like-minded individuals

### Success Metrics
- **Community Engagement:** 70%+ monthly active rate
- **Course Completion:** 60%+ average completion rate
- **User Retention:** 80%+ month-over-month retention
- **Content Creation:** 5+ posts per week per community

---

## Competitive Analysis

### Skool.com Features (What We're Emulating)
**Strengths:**
- Simple, clean interface (we'll match this with Mautic theme)
- Gamification that drives engagement (points, levels, leaderboard)
- Integrated courses with progress tracking
- Calendar for events and live sessions
- Member directory with filtering

**Pricing Model:** $99/month per community
**Target Market:** Course creators, coaches, consultants

### GoHighLevel Communities Features
**Strengths:**
- Built into existing CRM (like we're doing)
- Member approval workflow
- Direct messaging between members
- Live streaming integration
- Mobile app support

**Pricing Model:** Part of $297-$497/month plans
**Target Market:** Marketing agencies, service businesses

### Our Competitive Advantages
1. **Open Source Core:** Mautic is free, we're just adding value
2. **Multi-Tenant Ready:** One platform, many communities
3. **Marketing Automation:** Email sequences triggered by course progress, engagement
4. **CRM Integration:** Community members are automatically contacts
5. **Price Point:** Can undercut Skool and GHL significantly

---

## Architecture Overview

### Tech Stack Decisions

#### Frontend
- **Framework:** Next.js 14 (App Router) - Already in use
- **UI Components:** React 18 + Tailwind CSS (Mautic theme)
- **State Management:** React Context + SWR for data fetching
- **Real-time:** Socket.io for live updates (notifications, new posts)
- **Rich Text Editor:** TipTap (modern, extensible, React-friendly)
- **Video Player:** Video.js or Plyr (accessible, customizable)

#### Backend
- **API Routes:** Next.js API routes (serverless)
- **Database:** PostgreSQL 14+ (JSONB for flexibility)
- **ORM:** Prisma (type-safe, migrations, great DX)
- **Authentication:** NextAuth.js (already planning to use)
- **File Storage:**
  - **Phase 1 (MVP):** Local filesystem (simple, no costs)
  - **Phase 2 (Production):** Cloudflare R2 (S3-compatible, cheaper than AWS)
- **Video Processing:** FFmpeg for thumbnails/compression (optional)

#### Infrastructure
- **Hosting:** Vercel for Next.js (seamless deployment)
- **Database:** Supabase PostgreSQL or Railway (managed, affordable)
- **CDN:** Cloudflare (automatic with R2)
- **Monitoring:** Vercel Analytics + Sentry for errors

### Why These Choices?

**Next.js + PostgreSQL:**
- Already using Next.js for dashboard
- PostgreSQL handles complex relationships well (posts → comments → reactions)
- JSONB fields for flexible metadata (course progress, badge data)

**Prisma ORM:**
- Type-safe queries (catches bugs at compile time)
- Easy migrations (schema changes are simple)
- Auto-generated TypeScript types
- Great for multi-tenant architecture

**Cloudflare R2:**
- 90% cheaper than AWS S3 for storage
- No egress fees (video streaming is free)
- S3-compatible API (easy migration if needed)

**Socket.io:**
- Real-time notifications when someone comments on your post
- Live updates to leaderboard
- "User is typing..." indicators
- Online presence indicators

---

## Database Schema Design

### Core Entities & Relationships

```sql
-- ============================================
-- COMMUNITY & MEMBERSHIP
-- ============================================

Table: communities
- id (UUID, PK)
- tenant_id (FK → tenants.id) -- Multi-tenant support
- name (VARCHAR)
- slug (VARCHAR, UNIQUE) -- URL-friendly: /community/my-awesome-group
- description (TEXT)
- logo_url (VARCHAR)
- cover_image_url (VARCHAR)
- is_public (BOOLEAN) -- Public vs. Private community
- requires_approval (BOOLEAN) -- Manual member approval
- settings (JSONB) -- Flexible config: { allowPosts: true, allowComments: true }
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Table: community_members
- id (UUID, PK)
- community_id (FK → communities.id)
- user_id (FK → users.id)
- role (ENUM: owner, admin, moderator, member)
- status (ENUM: active, pending, banned, left)
- points (INTEGER, DEFAULT 0) -- Gamification
- level (INTEGER, DEFAULT 1) -- Based on points
- joined_at (TIMESTAMP)
- last_active_at (TIMESTAMP)
- settings (JSONB) -- Notification preferences, etc.

Table: users (extends existing user table)
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- name (VARCHAR)
- avatar_url (VARCHAR)
- bio (TEXT)
- title (VARCHAR) -- e.g., "Marketing Expert"
- location (VARCHAR)
- website (VARCHAR)
- social_links (JSONB) -- { twitter: "@handle", linkedin: "url" }
- mautic_contact_id (INTEGER) -- Link to Mautic contact
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

-- ============================================
-- COMMUNITY FEED (Posts, Comments, Reactions)
-- ============================================

Table: posts
- id (UUID, PK)
- community_id (FK → communities.id)
- author_id (FK → users.id)
- title (VARCHAR) -- Optional for posts
- content (TEXT) -- Rich text (HTML from TipTap)
- post_type (ENUM: discussion, question, announcement, poll)
- is_pinned (BOOLEAN, DEFAULT false)
- is_locked (BOOLEAN, DEFAULT false) -- Prevent new comments
- view_count (INTEGER, DEFAULT 0)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP, NULL) -- Soft delete

Table: comments
- id (UUID, PK)
- post_id (FK → posts.id)
- author_id (FK → users.id)
- parent_comment_id (FK → comments.id, NULL) -- For nested replies
- content (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP, NULL)

Table: reactions
- id (UUID, PK)
- reactable_type (ENUM: post, comment) -- Polymorphic
- reactable_id (UUID) -- Post ID or Comment ID
- user_id (FK → users.id)
- reaction_type (ENUM: like, love, celebrate, insightful)
- created_at (TIMESTAMP)
- UNIQUE(reactable_type, reactable_id, user_id) -- One reaction per user per item

Table: post_tags
- id (UUID, PK)
- community_id (FK → communities.id)
- name (VARCHAR)
- color (VARCHAR) -- Hex color for badge
- created_at (TIMESTAMP)

Table: post_tag_assignments
- post_id (FK → posts.id)
- tag_id (FK → post_tags.id)
- PRIMARY KEY (post_id, tag_id)

-- ============================================
-- COURSES & LEARNING
-- ============================================

Table: courses
- id (UUID, PK)
- community_id (FK → communities.id)
- title (VARCHAR)
- slug (VARCHAR)
- description (TEXT)
- thumbnail_url (VARCHAR)
- instructor_id (FK → users.id)
- is_published (BOOLEAN, DEFAULT false)
- is_free (BOOLEAN, DEFAULT false)
- price (DECIMAL, NULL) -- For paid courses
- level (ENUM: beginner, intermediate, advanced)
- estimated_duration_minutes (INTEGER)
- settings (JSONB) -- { allowDownloads: false, certificate: true }
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Table: course_modules
- id (UUID, PK)
- course_id (FK → courses.id)
- title (VARCHAR)
- description (TEXT)
- order (INTEGER) -- Display order
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Table: course_lessons
- id (UUID, PK)
- module_id (FK → course_modules.id)
- title (VARCHAR)
- content (TEXT) -- Rich text content
- lesson_type (ENUM: video, text, quiz, file_download)
- video_url (VARCHAR, NULL)
- video_duration_seconds (INTEGER, NULL)
- order (INTEGER)
- is_preview (BOOLEAN, DEFAULT false) -- Allow non-members to preview
- drip_delay_days (INTEGER, DEFAULT 0) -- Release X days after enrollment
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Table: course_enrollments
- id (UUID, PK)
- course_id (FK → courses.id)
- user_id (FK → users.id)
- enrolled_at (TIMESTAMP)
- completed_at (TIMESTAMP, NULL)
- progress_percent (INTEGER, DEFAULT 0)
- last_accessed_at (TIMESTAMP)
- certificate_issued_at (TIMESTAMP, NULL)

Table: lesson_progress
- id (UUID, PK)
- enrollment_id (FK → course_enrollments.id)
- lesson_id (FK → course_lessons.id)
- is_completed (BOOLEAN, DEFAULT false)
- time_spent_seconds (INTEGER, DEFAULT 0)
- completed_at (TIMESTAMP, NULL)
- UNIQUE(enrollment_id, lesson_id)

Table: course_quizzes
- id (UUID, PK)
- lesson_id (FK → course_lessons.id)
- title (VARCHAR)
- passing_score_percent (INTEGER, DEFAULT 80)
- max_attempts (INTEGER, NULL)
- questions (JSONB) -- Array of question objects
- created_at (TIMESTAMP)

Table: quiz_attempts
- id (UUID, PK)
- quiz_id (FK → course_quizzes.id)
- user_id (FK → users.id)
- score_percent (INTEGER)
- answers (JSONB) -- User's answers
- is_passed (BOOLEAN)
- attempted_at (TIMESTAMP)

-- ============================================
-- EVENTS & CALENDAR
-- ============================================

Table: events
- id (UUID, PK)
- community_id (FK → communities.id)
- host_id (FK → users.id)
- title (VARCHAR)
- description (TEXT)
- event_type (ENUM: webinar, q_and_a, workshop, social, livestream)
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- timezone (VARCHAR) -- e.g., "America/New_York"
- meeting_url (VARCHAR, NULL) -- Zoom, Google Meet, etc.
- max_attendees (INTEGER, NULL)
- is_recurring (BOOLEAN, DEFAULT false)
- recurrence_rule (VARCHAR, NULL) -- iCal RRULE format
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Table: event_attendees
- id (UUID, PK)
- event_id (FK → events.id)
- user_id (FK → users.id)
- status (ENUM: registered, attended, no_show, cancelled)
- registered_at (TIMESTAMP)
- attended_at (TIMESTAMP, NULL)

-- ============================================
-- GAMIFICATION
-- ============================================

Table: achievements
- id (UUID, PK)
- community_id (FK → communities.id)
- name (VARCHAR)
- description (TEXT)
- icon (VARCHAR) -- Emoji or image URL
- points_value (INTEGER)
- criteria (JSONB) -- { type: "posts_created", threshold: 10 }
- rarity (ENUM: common, rare, epic, legendary)
- created_at (TIMESTAMP)

Table: user_achievements
- id (UUID, PK)
- achievement_id (FK → achievements.id)
- user_id (FK → users.id)
- earned_at (TIMESTAMP)
- UNIQUE(achievement_id, user_id)

Table: point_transactions
- id (UUID, PK)
- user_id (FK → users.id)
- community_id (FK → communities.id)
- points (INTEGER) -- Can be negative for deductions
- reason (VARCHAR)
- source_type (ENUM: post_created, comment_created, course_completed, daily_login, etc.)
- source_id (UUID, NULL) -- FK to related entity
- created_at (TIMESTAMP)

Table: leaderboard_periods
- id (UUID, PK)
- community_id (FK → communities.id)
- period_type (ENUM: all_time, monthly, weekly, daily)
- start_date (DATE)
- end_date (DATE, NULL)
- rankings (JSONB) -- Cached rankings: [{ userId, points, rank }]
- last_calculated_at (TIMESTAMP)

-- ============================================
-- NOTIFICATIONS
-- ============================================

Table: notifications
- id (UUID, PK)
- user_id (FK → users.id)
- type (ENUM: post_comment, comment_reply, reaction, mention, achievement, event_reminder)
- title (VARCHAR)
- message (TEXT)
- action_url (VARCHAR) -- Where to navigate when clicked
- is_read (BOOLEAN, DEFAULT false)
- created_at (TIMESTAMP)

-- ============================================
-- MODERATION
-- ============================================

Table: reports
- id (UUID, PK)
- community_id (FK → communities.id)
- reporter_id (FK → users.id)
- reportable_type (ENUM: post, comment, user)
- reportable_id (UUID)
- reason (VARCHAR)
- description (TEXT)
- status (ENUM: pending, reviewed, resolved, dismissed)
- reviewed_by (FK → users.id, NULL)
- reviewed_at (TIMESTAMP, NULL)
- created_at (TIMESTAMP)

Table: banned_users
- id (UUID, PK)
- community_id (FK → communities.id)
- user_id (FK → users.id)
- banned_by (FK → users.id)
- reason (TEXT)
- banned_until (TIMESTAMP, NULL) -- NULL = permanent
- banned_at (TIMESTAMP)
```

### Indexes for Performance

```sql
-- Posts feed (most important query)
CREATE INDEX idx_posts_community_created ON posts(community_id, created_at DESC);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_pinned ON posts(community_id, is_pinned, created_at DESC);

-- Comments lookup
CREATE INDEX idx_comments_post ON comments(post_id, created_at ASC);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- Reactions
CREATE INDEX idx_reactions_post ON reactions(reactable_type, reactable_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);

-- Course progress
CREATE INDEX idx_enrollments_user ON course_enrollments(user_id);
CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX idx_lesson_progress_enrollment ON lesson_progress(enrollment_id);

-- Leaderboard
CREATE INDEX idx_members_points ON community_members(community_id, points DESC);
CREATE INDEX idx_members_last_active ON community_members(community_id, last_active_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
```

---

## Feature Specifications

### Phase 2A: Community Feed Foundation

#### Feature 2A.1: Community Feed
**User Story:** As a community member, I want to see recent posts and discussions so I can engage with the community.

**Functionality:**
- **Feed Display:**
  - Infinite scroll or pagination (20 posts per page)
  - Show post author (avatar, name, title, member since)
  - Post timestamp (relative: "2 hours ago")
  - Post content (rich text with formatting)
  - Reaction counts (👍 5, ❤️ 3, 🎉 2)
  - Comment count
  - View count

- **Post Types:**
  - **Discussion:** General conversation
  - **Question:** Marked with "?" icon, shows if answered
  - **Announcement:** Highlighted, pinned by default
  - **Poll:** Multiple choice voting (future enhancement)

- **Sorting Options:**
  - Latest (default)
  - Most popular (reactions + comments in last 7 days)
  - Unanswered questions
  - Following (posts from people you follow)

- **Filtering:**
  - By tag
  - By author
  - Date range

#### Feature 2A.2: Create Post
**User Story:** As a community member, I want to create posts to share ideas and ask questions.

**Functionality:**
- **Rich Text Editor (TipTap):**
  - Bold, italic, underline
  - Headings (H2, H3)
  - Bulleted and numbered lists
  - Links (auto-preview with Open Graph)
  - Images (drag & drop or paste)
  - Code blocks with syntax highlighting
  - Mentions (@username)
  - Emojis

- **Post Settings:**
  - Title (optional, recommended for questions)
  - Tags (select from existing or create new)
  - Visibility: Everyone, Members only
  - Notify followers (checkbox)

- **Validation:**
  - Min 10 characters for content
  - Max 10,000 characters
  - Max 5 tags per post
  - Max 10 images per post

- **Auto-Save:**
  - Save draft every 10 seconds to localStorage
  - Restore draft if browser closes

#### Feature 2A.3: Comments & Replies
**User Story:** As a community member, I want to comment on posts and reply to comments to have threaded discussions.

**Functionality:**
- **Comment Display:**
  - Nested up to 3 levels deep
  - "Load more replies" for long threads
  - Show comment author and timestamp
  - Reaction buttons on each comment
  - Edit/delete (own comments only, within 15 min)

- **Comment Editor:**
  - Inline rich text editor (simpler than posts)
  - Bold, italic, links, mentions, emojis
  - @mention autocomplete
  - "Reply" button creates nested comment

- **Notifications:**
  - Notify post author when someone comments
  - Notify comment author when someone replies
  - Notify mentioned users
  - Batch notifications (max 1 email per hour)

#### Feature 2A.4: Reactions
**User Story:** As a community member, I want to react to posts and comments to show appreciation without writing a comment.

**Functionality:**
- **Reaction Types:**
  - 👍 Like (default)
  - ❤️ Love
  - 🎉 Celebrate
  - 💡 Insightful

- **Interaction:**
  - Click to add reaction
  - Click again to remove
  - Hover to see who reacted
  - Show count badge

- **Points:**
  - Post author gets +2 points per unique reaction
  - Comment author gets +1 point per unique reaction

#### Feature 2A.5: Member Profiles
**User Story:** As a community member, I want to view other members' profiles to learn about them and see their contributions.

**Functionality:**
- **Profile Display:**
  - Avatar, name, title, bio
  - Location, website, social links
  - Member since date
  - Current level and points
  - Badges earned
  - Activity stats:
    - Total posts
    - Total comments
    - Helpful reactions received
    - Courses completed

- **Activity Feed:**
  - Recent posts (last 10)
  - Recent comments (last 10)
  - Achievements earned

- **Profile Actions:**
  - Send direct message (future)
  - Follow user (future)
  - Report user (if spam/abuse)

- **Edit Profile:**
  - Upload avatar (max 2MB)
  - Update bio (max 500 chars)
  - Add social links
  - Privacy settings

#### Feature 2A.6: Search
**User Story:** As a community member, I want to search for posts, people, and courses to find relevant content.

**Functionality:**
- **Search Scope:**
  - Posts (title + content)
  - Comments
  - People (name + bio)
  - Courses

- **Search Features:**
  - Real-time suggestions (debounced)
  - Filters: Type, Date range, Author
  - Highlight matching terms
  - Recent searches (saved locally)

- **Implementation:**
  - PostgreSQL full-text search initially
  - Consider Algolia or Meilisearch for better UX (later)

### Phase 2B: Course System

#### Feature 2B.1: Course Catalog
**User Story:** As a community member, I want to browse available courses to find learning opportunities.

**Functionality:**
- **Catalog Display:**
  - Grid layout with thumbnails
  - Course title, instructor, level
  - Duration, lesson count
  - Enrollment count
  - Rating (future: member ratings)
  - "Enrolled" badge if already enrolled

- **Filtering:**
  - By level (beginner, intermediate, advanced)
  - By instructor
  - Free vs. Paid
  - Completed vs. In Progress vs. Not Started

- **Sorting:**
  - Newest
  - Most popular
  - Alphabetical

#### Feature 2B.2: Course Player
**User Story:** As a student, I want to watch course videos and read lessons to learn new skills.

**Functionality:**
- **Video Player:**
  - Custom controls (play, pause, volume, fullscreen)
  - Playback speed (0.5x, 1x, 1.25x, 1.5x, 2x)
  - Keyboard shortcuts (spacebar, arrows)
  - Auto-advance to next lesson (optional)
  - Resume from last position
  - Closed captions (future)

- **Lesson Layout:**
  - Video in main area (if video lesson)
  - Lesson content below video (rich text)
  - Resources/downloads section
  - Comments section (lesson-specific Q&A)

- **Sidebar:**
  - Course outline (modules + lessons)
  - Progress indicator per lesson
  - Checkmark when completed
  - Collapse/expand modules

- **Progress Tracking:**
  - Auto-mark as complete when video reaches 90%
  - Manual "Mark Complete" button for text lessons
  - Track time spent per lesson
  - Sync progress to server every 30 seconds

#### Feature 2B.3: Course Builder (Admin/Instructor)
**User Story:** As an instructor, I want to create and manage courses easily.

**Functionality:**
- **Course Creation Wizard:**
  1. Basic Info (title, description, thumbnail)
  2. Add Modules (drag to reorder)
  3. Add Lessons to Modules (drag to reorder)
  4. Publish Settings

- **Lesson Editor:**
  - Upload video (progress bar)
  - Rich text content editor
  - Add downloadable files
  - Set drip schedule (release X days after enrollment)
  - Preview lesson

- **Video Upload:**
  - Direct upload to R2
  - Generate thumbnail from video frame
  - Extract duration automatically
  - Show upload progress

- **Course Settings:**
  - Pricing (free or paid)
  - Auto-enroll all members (yes/no)
  - Certificate on completion (yes/no)
  - Allow downloads (yes/no)

#### Feature 2B.4: Progress & Certificates
**User Story:** As a student, I want to track my progress and earn certificates to showcase my achievements.

**Functionality:**
- **Progress Dashboard:**
  - Overall course progress (%)
  - Lessons completed / total
  - Time spent learning
  - Estimated time remaining
  - Next lesson recommendation

- **Certificate Generation:**
  - Auto-issued when 100% complete
  - PDF download with:
    - Student name
    - Course title
    - Completion date
    - Instructor signature
    - Unique certificate ID
  - Shareable link (LinkedIn, etc.)

- **Certificate Verification:**
  - Public verification page (/verify-certificate/:id)
  - Shows certificate details
  - Prevents fraud

### Phase 2C: Events & Gamification

#### Feature 2C.1: Events Calendar
**User Story:** As a community member, I want to see upcoming events and register to attend.

**Functionality:**
- **Calendar View:**
  - Month view (default)
  - Week view
  - List view
  - Color-coded by event type

- **Event Display:**
  - Title, description, host
  - Date and time (with timezone)
  - Duration
  - Attendee count / max capacity
  - Meeting link (shown after registration)

- **Registration:**
  - One-click register
  - Add to personal calendar (iCal, Google)
  - Email reminder (1 day before, 1 hour before)
  - Cancel registration

- **Event Types:**
  - Webinar (presenter + Q&A)
  - Q&A Session (interactive)
  - Workshop (hands-on)
  - Social Hangout
  - Livestream

#### Feature 2C.2: Gamification System
**User Story:** As a community member, I want to earn points and badges to feel recognized for my contributions.

**Functionality:**
- **Point System:**
  - Create a post: +10 points
  - Write a comment: +5 points
  - Receive a reaction: +2 points
  - Complete a course: +50 points
  - Daily login streak: +5 points/day
  - Attend an event: +20 points

- **Levels:**
  - Level 1: Newbie (0-99 points)
  - Level 2: Regular (100-299 points)
  - Level 3: Active (300-999 points)
  - Level 4: Power Member (1000-2999 points)
  - Level 5: Expert (3000-9999 points)
  - Level 6: Legend (10,000+ points)

- **Badges/Achievements:**
  - First Post
  - 10 Posts Created
  - 100 Helpful Reactions
  - Course Completionist (finish all courses)
  - Event Enthusiast (attend 10 events)
  - Community Champion (reach Level 6)
  - Early Adopter (first 100 members)

- **Leaderboard:**
  - All-Time Top 10
  - This Month Top 10
  - This Week Top 10
  - Filter by category (posts, courses, events)
  - Show user's rank even if not in top 10

#### Feature 2C.3: Notifications
**User Story:** As a community member, I want to be notified of important activity so I stay engaged.

**Functionality:**
- **Notification Types:**
  - Someone commented on your post
  - Someone replied to your comment
  - Someone reacted to your post/comment
  - Someone mentioned you
  - New achievement unlocked
  - Event starting soon (1 hour before)
  - Course lesson unlocked (drip feed)

- **Notification Center:**
  - Bell icon in header with unread count
  - Dropdown with recent notifications (last 10)
  - "Mark all as read" button
  - Click to navigate to relevant page

- **Email Notifications:**
  - Digest email (daily or weekly)
  - Individual emails for important events
  - Unsubscribe options

- **Push Notifications:**
  - Browser push (with permission)
  - "Enable notifications" prompt on first visit

---

## User Experience Flows

### Flow 1: New Member Onboarding

```
1. User Signs Up
   ↓
2. Email Verification
   ↓
3. Welcome to Community Page
   - Brief tour (optional)
   - Complete profile (avatar, bio)
   ↓
4. Browse Community Feed
   - See pinned welcome post
   - Encouraged to introduce themselves
   ↓
5. First Post Achievement
   - "Welcome! 🎉" badge
   - +10 points
```

### Flow 2: Creating and Engaging with a Post

```
1. User Clicks "Create Post"
   ↓
2. Rich Text Editor Opens
   - Type content
   - Add images
   - Select tags
   ↓
3. Post Published
   - Appears in feed
   - Followers notified
   ↓
4. Other Members Engage
   - View post
   - Add reactions
   - Write comments
   ↓
5. Author Receives Notifications
   - New comment alert
   - Points earned for reactions
```

### Flow 3: Taking a Course

```
1. Browse Course Catalog
   ↓
2. Click Course → View Details
   - Syllabus
   - Instructor
   - Reviews
   ↓
3. Enroll in Course
   - Auto-enrolled if free
   - Payment if paid (future)
   ↓
4. Watch First Lesson
   - Video plays
   - Progress tracked
   ↓
5. Complete Lesson
   - Auto-marked at 90%
   - Next lesson unlocked (if drip-fed)
   ↓
6. Finish Course
   - Certificate issued
   - Achievement unlocked
   - Share on LinkedIn
```

### Flow 4: Hosting an Event

```
1. Admin Creates Event
   - Fill details
   - Set date/time
   - Add meeting link
   ↓
2. Event Published
   - Appears in calendar
   - Members can register
   ↓
3. Reminders Sent
   - 1 day before email
   - 1 hour before notification
   ↓
4. Event Happens
   - Members join via link
   - Attendance tracked
   ↓
5. Post-Event
   - Recording uploaded (optional)
   - Points awarded to attendees
```

---

## Technical Implementation Plan

### Phase 2A: Community Feed (Week 1)

#### Day 1-2: Database Setup
- [x] Install and configure PostgreSQL
- [x] Set up Prisma ORM
- [x] Create initial schema (communities, users, posts, comments)
- [x] Write seed data for testing
- [x] Run migrations

#### Day 3-4: API Routes
- [x] POST `/api/communities/:id/posts` - Create post
- [x] GET `/api/communities/:id/posts` - List posts (with pagination)
- [x] GET `/api/posts/:id` - Get single post with comments
- [x] POST `/api/posts/:id/comments` - Add comment
- [x] POST `/api/posts/:id/reactions` - Add/remove reaction
- [x] GET `/api/users/:id` - Get user profile

#### Day 5-7: Frontend Components
- [x] `CommunityFeed.tsx` - Main feed component
- [x] `PostCard.tsx` - Individual post display
- [x] `CreatePostModal.tsx` - Rich text editor modal
- [x] `CommentSection.tsx` - Comments thread
- [x] `ReactionButton.tsx` - Reaction UI
- [x] `UserProfile.tsx` - Profile page
- [x] `CommunityLayout.tsx` - Sidebar + header

#### Integration
- [x] Add "Community" link to main sidebar
- [x] Route: `/community/:slug` → Community feed
- [x] Link Mautic contacts to community users

### Phase 2B: Course System (Week 2)

#### Day 8-9: Database Schema
- [x] Add courses, modules, lessons tables
- [x] Add enrollments, progress tables
- [x] Add quizzes table
- [x] Run migrations

#### Day 10-11: API Routes
- [x] GET `/api/communities/:id/courses` - List courses
- [x] GET `/api/courses/:id` - Course details
- [x] POST `/api/courses/:id/enroll` - Enroll user
- [x] GET `/api/courses/:id/lessons/:lessonId` - Get lesson
- [x] POST `/api/lessons/:id/progress` - Update progress
- [x] POST `/api/courses` - Create course (admin)

#### Day 12-14: Frontend Components
- [x] `CourseCatalog.tsx` - Browse courses
- [x] `CourseDetails.tsx` - Course overview
- [x] `CoursePlayer.tsx` - Video player + lesson content
- [x] `CourseBuilder.tsx` - Admin course creation
- [x] `ProgressTracker.tsx` - User progress dashboard
- [x] `CertificateGenerator.tsx` - PDF generation

#### Integration
- [x] Add "Courses" tab to community page
- [x] Set up video storage (Cloudflare R2)
- [x] Integrate video upload

### Phase 2C: Events & Gamification (Week 3)

#### Day 15-16: Database Schema
- [x] Add events, attendees tables
- [x] Add achievements, point_transactions tables
- [x] Add notifications table
- [x] Run migrations

#### Day 17-18: API Routes
- [x] GET `/api/communities/:id/events` - List events
- [x] POST `/api/events` - Create event (admin)
- [x] POST `/api/events/:id/register` - Register for event
- [x] GET `/api/leaderboard` - Get rankings
- [x] GET `/api/notifications` - Get user notifications
- [x] POST `/api/notifications/:id/read` - Mark as read

#### Day 19-21: Frontend Components
- [x] `EventsCalendar.tsx` - Calendar view
- [x] `EventCard.tsx` - Event details
- [x] `Leaderboard.tsx` - Rankings display
- [x] `AchievementBadge.tsx` - Badge component
- [x] `NotificationCenter.tsx` - Notification dropdown
- [x] `PointsDisplay.tsx` - User's points/level

#### Integration
- [x] Add "Events" tab to community page
- [x] Add notification bell to header
- [x] Add points to user profile
- [x] Award points for actions automatically

### Testing & Polish (Ongoing)

#### Unit Tests
- API route error handling
- Database queries
- Utility functions

#### Integration Tests
- Full user flows (create post → comment → react)
- Course enrollment and progress tracking
- Event registration

#### UI/UX Polish
- Loading states everywhere
- Error states with retry
- Empty states with helpful CTAs
- Responsive design (mobile-first)
- Accessibility (WCAG 2.1 AA)

---

## Security & Privacy

### Authentication
- **NextAuth.js** for session management
- **JWT tokens** for API authentication
- **Role-based access control (RBAC):**
  - Community Owner: Full control
  - Admin: Manage members, moderate content
  - Moderator: Delete posts/comments, ban users
  - Member: Post, comment, react

### Data Protection
- **Input Sanitization:**
  - DOMPurify for rich text content
  - Validate all user inputs
  - Prevent XSS attacks

- **SQL Injection Prevention:**
  - Prisma ORM (parameterized queries)
  - Never use raw SQL with user input

- **File Upload Security:**
  - Whitelist allowed file types (images: jpg, png, gif, webp; videos: mp4, webm)
  - Max file sizes (images: 5MB, videos: 500MB)
  - Scan for malware (ClamAV or VirusTotal API)
  - Generate random filenames (prevent overwriting)

### Privacy Features
- **User Privacy Settings:**
  - Profile visibility (public, members-only, private)
  - Activity visibility
  - Email notification preferences

- **Data Deletion:**
  - GDPR-compliant data export
  - "Delete Account" removes all PII
  - Soft-delete posts/comments (keep for 30 days)

### Content Moderation
- **Automated:**
  - Filter profanity (bad-words library)
  - Detect spam (rate limiting, duplicate content)
  - Block suspicious links

- **Manual:**
  - Report button on all content
  - Admin moderation queue
  - Ban users (temporary or permanent)

---

## Scalability Considerations

### Database Optimization
- **Indexes:** Already defined in schema section
- **Caching:** Redis for frequently accessed data
  - User profiles (1 hour TTL)
  - Leaderboard (15 min TTL)
  - Course catalog (1 hour TTL)
- **Read Replicas:** For read-heavy queries (later)

### API Optimization
- **Pagination:** Max 20-50 items per request
- **Rate Limiting:**
  - 100 requests/minute per user
  - 10 POST requests/minute (prevent spam)
- **CDN:** Cloudflare for static assets (images, videos)
- **Compression:** Gzip/Brotli for API responses

### File Storage
- **Video Streaming:**
  - Use Cloudflare R2 (99.9% uptime)
  - HLS or DASH for adaptive bitrate (later)
  - Thumbnail generation (FFmpeg)

- **Image Optimization:**
  - Next.js Image component (auto-optimization)
  - WebP format with fallbacks
  - Lazy loading

### Real-time Features
- **Socket.io Scaling:**
  - Redis adapter for multi-server support
  - Sticky sessions (load balancer)
  - Fallback to polling if WebSocket fails

### Monitoring
- **Performance:**
  - Vercel Analytics (Core Web Vitals)
  - Database query timing (Prisma logs)
  - API endpoint response times

- **Errors:**
  - Sentry for error tracking
  - Slack alerts for critical errors
  - Weekly error reports

---

## Integration with Existing Dashboard

### Navigation Changes
```
Current Sidebar:
- Dashboard
- Contacts
- Campaigns
- Emails
- SMS
- Segments
- Forms
- Reports

Add:
- Community (new section)
  - Feed
  - Courses
  - Events
  - Leaderboard
  - Members
```

### Mautic Contact Sync
When a user joins the community:
1. Check if email exists in Mautic contacts
2. If yes, link `mautic_contact_id`
3. If no, create new contact in Mautic
4. Add to "Community Members" segment
5. Trigger "Welcome to Community" email campaign

### Automation Triggers
- **New Member:** Send welcome email, assign to onboarding campaign
- **First Post:** Tag as "Engaged Member"
- **Course Completed:** Tag with course name, send certificate email
- **Inactive (30 days):** Add to re-engagement campaign

### Reporting
Add to Reports page:
- Community growth chart
- Engagement metrics (posts/week, comments/week)
- Course completion rates
- Event attendance rates
- Top contributors

---

## Testing Strategy

### Unit Tests (Jest)
- API route handlers
- Database models (Prisma)
- Utility functions
- Component logic

### Integration Tests (Playwright)
- User signup flow
- Create post → comment → react
- Enroll in course → watch lesson → complete
- Register for event

### Manual Testing Checklist
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Test on desktop (Chrome, Firefox, Safari, Edge)
- [ ] Test slow network (3G throttling)
- [ ] Test with screen reader (accessibility)
- [ ] Test with 1000+ posts (performance)
- [ ] Test file upload limits
- [ ] Test concurrent users (10+ people online)

### Load Testing
- Simulate 100 concurrent users
- Test database query performance
- Test video streaming bandwidth
- Test Socket.io connections

---

## Future Enhancements (Post-MVP)

### Phase 3 Ideas
1. **Mobile App** (React Native)
   - Native push notifications
   - Offline content access
   - Better video performance

2. **Direct Messaging**
   - 1-on-1 chat between members
   - Group chats
   - File sharing

3. **Advanced Gamification**
   - Custom badges per community
   - Contests and challenges
   - Rewards marketplace (redeem points for perks)

4. **Live Streaming**
   - Built-in streaming (OBS integration)
   - Live chat during streams
   - Recording auto-posted to courses

5. **AI Features**
   - Auto-suggest tags for posts
   - Content moderation (detect toxic content)
   - Personalized course recommendations
   - Chatbot for common questions

6. **Monetization**
   - Paid memberships (tiered access)
   - Paid courses
   - Sponsorships
   - Affiliate links

7. **Integrations**
   - Zapier webhooks
   - Slack/Discord notifications
   - Zoom for events
   - Stripe for payments

---

## Success Criteria

### MVP Launch Metrics (30 days post-launch)
- [ ] 100+ community members
- [ ] 50+ posts created
- [ ] 200+ comments
- [ ] 10+ courses published
- [ ] 5+ events hosted
- [ ] 80% user satisfaction (survey)

### Technical Metrics
- [ ] <2s page load time (95th percentile)
- [ ] <500ms API response time (95th percentile)
- [ ] 99.9% uptime
- [ ] 0 critical bugs
- [ ] <5% error rate

### Engagement Metrics
- [ ] 70% monthly active users
- [ ] 40% weekly active users
- [ ] 5+ posts per week per community
- [ ] 60% course completion rate
- [ ] 80% event attendance rate

---

## Conclusion

This plan outlines a comprehensive, production-ready membership/community area that rivals Skool.com and GHL Communities while integrating seamlessly with the existing Mautic dashboard.

**Key Differentiators:**
- Built on open-source Mautic (cost advantage)
- Deep CRM integration (automation based on community activity)
- Multi-tenant architecture (scale to many communities)
- Modern tech stack (Next.js 14, PostgreSQL, Prisma)

**Timeline:** 3 weeks for MVP (all core features)

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 2A implementation
4. Iterate based on feedback

Let's build something amazing! 🚀
