# Community Feed API Test Plan

## Prerequisites

1. **Setup Database:**
   ```bash
   cd /Users/michaelkraft/mautic-platform/dashboard
   npx prisma generate
   npx prisma db push
   ```

2. **Seed Test Data:**
   Create a basic seed script or use Prisma Studio to create:
   - A test community
   - A test user
   - A community membership linking them

## Manual Testing Steps

### 1. Create a Post

```bash
curl -X POST http://localhost:3000/api/communities/COMMUNITY_ID/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{
    "title": "Welcome to Our Community!",
    "content": "This is the first post in our community. Feel free to ask questions and share your thoughts!",
    "type": "announcement",
    "isPinned": false,
    "tags": [
      {"name": "welcome", "color": "#3b82f6"},
      {"name": "announcement", "color": "#10b981"}
    ]
  }'
```

**Expected:** 201 Created with post object

### 2. List Posts

```bash
curl "http://localhost:3000/api/communities/COMMUNITY_ID/posts?page=1&limit=20" \
  -H "x-user-id: USER_ID"
```

**Expected:** 200 OK with paginated posts array

### 3. Get Single Post

```bash
curl http://localhost:3000/api/posts/POST_ID \
  -H "x-user-id: USER_ID"
```

**Expected:** 200 OK with post details and empty comments array

### 4. Add a Comment

```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{
    "content": "Great post! Looking forward to being part of this community."
  }'
```

**Expected:** 201 Created with comment object

### 5. Reply to Comment

```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "x-user-id: DIFFERENT_USER_ID" \
  -d '{
    "content": "Welcome! Glad to have you here.",
    "parentCommentId": "COMMENT_ID"
  }'
```

**Expected:** 201 Created with nested comment

### 6. Add Reactions

```bash
# Add 'like' reaction
curl -X POST http://localhost:3000/api/posts/POST_ID/reactions \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{"reactionType": "like"}'

# Add 'love' reaction
curl -X POST http://localhost:3000/api/posts/POST_ID/reactions \
  -H "Content-Type: application/json" \
  -H "x-user-id: DIFFERENT_USER_ID" \
  -d '{"reactionType": "love"}'
```

**Expected:** 200 OK with action: "added" and updated counts

### 7. Toggle Reaction (Remove)

```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/reactions \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{"reactionType": "like"}'
```

**Expected:** 200 OK with action: "removed"

### 8. Get Reactions

```bash
curl http://localhost:3000/api/posts/POST_ID/reactions \
  -H "x-user-id: USER_ID"
```

**Expected:** 200 OK with reactions grouped by type

### 9. Update Post (Within 15 Minutes)

```bash
curl -X PATCH http://localhost:3000/api/posts/POST_ID \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{
    "title": "Updated: Welcome to Our Community!",
    "content": "Updated content with more details..."
  }'
```

**Expected:** 200 OK if within 15min window, 403 Forbidden if expired

### 10. Delete Post

```bash
curl -X DELETE http://localhost:3000/api/posts/POST_ID \
  -H "x-user-id: USER_ID"
```

**Expected:** 200 OK with success message

## Filtering and Pagination Tests

### Filter by Type
```bash
curl "http://localhost:3000/api/communities/COMMUNITY_ID/posts?type=question" \
  -H "x-user-id: USER_ID"
```

### Filter by Author
```bash
curl "http://localhost:3000/api/communities/COMMUNITY_ID/posts?authorId=USER_ID" \
  -H "x-user-id: USER_ID"
```

### Filter by Tag
```bash
curl "http://localhost:3000/api/communities/COMMUNITY_ID/posts?tag=help" \
  -H "x-user-id: USER_ID"
```

### Pagination
```bash
curl "http://localhost:3000/api/communities/COMMUNITY_ID/posts?page=2&limit=5" \
  -H "x-user-id: USER_ID"
```

## Error Handling Tests

### 1. Unauthorized Request
```bash
curl http://localhost:3000/api/posts/POST_ID
```
**Expected:** 401 Unauthorized

### 2. Non-member Trying to Post
```bash
curl -X POST http://localhost:3000/api/communities/COMMUNITY_ID/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: NON_MEMBER_USER_ID" \
  -d '{"title": "Test", "content": "Test"}'
```
**Expected:** 403 Forbidden

### 3. Invalid Post Type
```bash
curl -X POST http://localhost:3000/api/communities/COMMUNITY_ID/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{
    "title": "Test",
    "content": "Test",
    "type": "invalid_type"
  }'
```
**Expected:** 400 Bad Request

### 4. Invalid Reaction Type
```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/reactions \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{"reactionType": "invalid"}'
```
**Expected:** 400 Bad Request

### 5. Nested Comment Beyond 3 Levels
```bash
# After creating 3 levels of nested comments
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{
    "content": "Fourth level comment",
    "parentCommentId": "THIRD_LEVEL_COMMENT_ID"
  }'
```
**Expected:** 400 Bad Request with nesting depth error

### 6. Non-author Trying to Edit (After 15min)
```bash
curl -X PATCH http://localhost:3000/api/posts/POST_ID \
  -H "Content-Type: application/json" \
  -H "x-user-id: DIFFERENT_USER_ID" \
  -d '{"title": "Hacked!"}'
```
**Expected:** 403 Forbidden

### 7. Regular User Trying to Pin Post
```bash
curl -X POST http://localhost:3000/api/communities/COMMUNITY_ID/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: REGULAR_USER_ID" \
  -d '{
    "title": "Test",
    "content": "Test",
    "isPinned": true
  }'
```
**Expected:** 403 Forbidden

## Notification Tests

After performing these actions, check the notifications table:

1. **Comment on post** - Post author should get notification
2. **Reply to comment** - Comment author should get notification
3. **Reaction on post** - Post author should get notification

```sql
SELECT * FROM notifications WHERE userId = 'POST_AUTHOR_ID' ORDER BY createdAt DESC;
```

## Performance Tests

### 1. List Posts with Large Dataset
Create 100+ posts and verify pagination works smoothly.

### 2. Nested Comments Performance
Create deeply nested comment threads (3 levels) with multiple replies.

### 3. Reaction Aggregation
Add 50+ reactions of different types and verify counts are accurate.

## Integration Tests

Create automated tests using the following structure:

```typescript
// __tests__/api/posts.test.ts
import { POST, GET } from '@/app/api/communities/[id]/posts/route';

describe('Community Posts API', () => {
  it('should create a post', async () => {
    // Test implementation
  });

  it('should list posts with pagination', async () => {
    // Test implementation
  });

  it('should filter posts by type', async () => {
    // Test implementation
  });
});
```

## Success Criteria

All tests should pass with:
- ✅ Correct HTTP status codes
- ✅ Proper error messages
- ✅ Data validation
- ✅ Authorization checks
- ✅ Cascade deletions working
- ✅ Notifications created
- ✅ Pagination working correctly
- ✅ Nested comments limited to 3 levels
- ✅ Reaction toggle behavior working
- ✅ 15-minute edit window enforced
