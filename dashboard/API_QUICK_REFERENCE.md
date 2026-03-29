# Community Feed API - Quick Reference

## Quick Start

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Push schema to database
npx prisma db push

# 3. Start dev server
npm run dev

# 4. Test endpoints (replace IDs and USER_ID)
curl -H "x-user-id: USER_ID" http://localhost:3000/api/communities/COMM_ID/posts
```

## Common Workflows

### Create a Discussion Post
```bash
POST /api/communities/{id}/posts
{
  "title": "How do I setup email campaigns?",
  "content": "I'm new to Mautic and need help...",
  "type": "question",
  "tags": [{"name": "help"}, {"name": "email"}]
}
```

### Add a Comment
```bash
POST /api/posts/{id}/comments
{
  "content": "You need to configure SMTP settings first..."
}
```

### Reply to Comment
```bash
POST /api/posts/{id}/comments
{
  "content": "Thanks! Where do I find that?",
  "parentCommentId": "comment_123"
}
```

### React to Post
```bash
POST /api/posts/{id}/reactions
{
  "reactionType": "like"  # or "love", "celebrate", "insightful"
}
```

### List Posts with Filters
```bash
GET /api/communities/{id}/posts?type=question&tag=help&page=1&limit=20
```

## Authentication

**Development:**
```bash
-H "x-user-id: user_123"
```

**Production (future):**
```bash
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing auth) |
| 403 | Forbidden (not allowed) |
| 404 | Not Found |
| 500 | Server Error |

## Permissions

| Action | Required Role |
|--------|--------------|
| Create post | member+ |
| Edit own post | author (15min) or moderator+ |
| Delete own post | author or moderator+ |
| Pin post | moderator+ |
| Comment | member+ |
| React | member+ |

## Validation Rules

- **Post title:** Required, non-empty
- **Post content:** Required, non-empty
- **Post type:** `discussion`, `question`, or `announcement`
- **Comment content:** Required, non-empty
- **Comment nesting:** Max 3 levels
- **Reaction type:** `like`, `love`, `celebrate`, or `insightful`
- **Tag color:** Hex color code (default: `#3b82f6`)

## Pagination

Default: 20 items per page

```bash
?page=1&limit=20
```

Response includes:
```json
{
  "posts": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

## Filtering

**By Type:**
```bash
?type=question
```

**By Author:**
```bash
?authorId=user_123
```

**By Tag:**
```bash
?tag=help
```

**Combined:**
```bash
?type=question&tag=help&page=2
```

## Notifications

Auto-created for:
- Someone comments on your post
- Someone replies to your comment
- Someone reacts to your post

Check notifications table:
```sql
SELECT * FROM notifications
WHERE userId = 'user_123'
  AND isRead = false
ORDER BY createdAt DESC;
```

## Import in Code

```typescript
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth-helpers';
import type { Post, Comment, Reaction } from '@/types/api';
```

## Common Errors

**"Unauthorized"**
→ Add `x-user-id` header

**"Not a member of this community"**
→ Create community membership first

**"Edit window has expired"**
→ Post created >15 minutes ago, need moderator role

**"Maximum comment nesting depth reached"**
→ Already 3 levels deep, reply to parent comment instead

**"Only moderators can pin posts"**
→ User role is `member`, need `moderator`, `admin`, or `owner`

## File Locations

```
src/
├── app/api/
│   ├── communities/[id]/posts/route.ts    # List & create posts
│   ├── posts/[id]/
│   │   ├── route.ts                       # Get, update, delete post
│   │   ├── comments/route.ts              # List & create comments
│   │   └── reactions/route.ts             # Get & toggle reactions
│   ├── README.md                          # Full documentation
│   └── TEST_PLAN.md                       # Testing guide
├── lib/
│   ├── prisma.ts                          # Prisma client
│   └── auth-helpers.ts                    # Auth utilities
└── types/
    └── api.ts                             # TypeScript types
```

## TypeScript Types

```typescript
import {
  Post,
  Comment,
  Reaction,
  PostType,
  ReactionType,
  CreatePostRequest,
  UpdatePostRequest,
  CreateCommentRequest,
  ToggleReactionRequest,
} from '@/types/api';
```

## Prisma Models

- **Post** - Main content item
- **Comment** - Nested comments (self-referencing)
- **Reaction** - Polymorphic (post/comment)
- **PostTag** - Tag metadata
- **CommunityMember** - User membership
- **Notification** - System notifications

## Testing Checklist

- [ ] Create post as member
- [ ] List posts with pagination
- [ ] Filter by type, author, tag
- [ ] Get single post with comments
- [ ] Add top-level comment
- [ ] Reply to comment (2nd level)
- [ ] Reply to reply (3rd level)
- [ ] Verify 4th level blocked
- [ ] Add reaction to post
- [ ] Toggle reaction (remove)
- [ ] Edit post within 15min
- [ ] Verify edit blocked after 15min
- [ ] Edit as moderator (no time limit)
- [ ] Pin post as moderator
- [ ] Verify pin blocked for member
- [ ] Delete own post
- [ ] Verify delete blocked for other user
- [ ] Check notifications created

## Performance Tips

1. Use indexes (already in schema)
2. Limit pagination size
3. Use `select` to reduce data transfer
4. Cache reaction counts
5. Implement infinite scroll on frontend
6. Use optimistic UI updates

## Next Steps

1. Build React hooks for data fetching
2. Create UI components (PostCard, CommentThread)
3. Add WebSocket for real-time updates
4. Implement JWT authentication
5. Add rate limiting
6. Setup error tracking (Sentry)

---

**Full Docs:** `src/app/api/README.md`
**Test Plan:** `src/app/api/TEST_PLAN.md`
**Implementation:** `COMMUNITY_API_IMPLEMENTATION.md`
