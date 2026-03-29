# Community Feed API Documentation

Complete API documentation for the Mautic Platform community feed features.

## Authentication

All endpoints require authentication via the `x-user-id` header.

```bash
curl -H "x-user-id: user_123" http://localhost:3000/api/...
```

**Note**: In production, this will be replaced with JWT Bearer token authentication.

## Endpoints

### Posts

#### List Posts in Community

**GET** `/api/communities/:id/posts`

Get paginated list of posts for a community with filtering options.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Posts per page
- `type` (string, optional) - Filter by post type: `discussion`, `question`, `announcement`
- `authorId` (string, optional) - Filter by author ID
- `tag` (string, optional) - Filter by tag name

**Response:**
```json
{
  "posts": [
    {
      "id": "post_123",
      "communityId": "community_123",
      "authorId": "user_123",
      "title": "Welcome to the community!",
      "content": "This is the first post...",
      "type": "announcement",
      "isPinned": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": "user_123",
        "name": "John Doe",
        "avatar": "https://...",
        "role": "admin"
      },
      "tags": [
        { "id": "tag_1", "name": "announcement", "color": "#3b82f6" }
      ],
      "reactions": {
        "like": 5,
        "love": 2
      },
      "_count": {
        "comments": 3
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### Create Post

**POST** `/api/communities/:id/posts`

Create a new post in a community.

**Headers:**
- `x-user-id`: User ID (required)

**Body:**
```json
{
  "title": "My First Post",
  "content": "This is the content of my post...",
  "type": "discussion",
  "isPinned": false,
  "tags": [
    { "name": "general", "color": "#3b82f6" },
    { "name": "help" }
  ]
}
```

**Response:** (201 Created)
```json
{
  "id": "post_123",
  "title": "My First Post",
  "content": "This is the content...",
  "type": "discussion",
  "isPinned": false,
  "author": { ... },
  "tags": [ ... ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Validation:**
- Only moderators/admins can set `isPinned: true`
- `type` must be one of: `discussion`, `question`, `announcement`
- User must be a member of the community

---

#### Get Single Post

**GET** `/api/posts/:id`

Get a single post with all comments (nested up to 3 levels).

**Response:**
```json
{
  "id": "post_123",
  "title": "My Post",
  "content": "Content...",
  "type": "discussion",
  "author": { ... },
  "community": {
    "id": "community_123",
    "name": "My Community",
    "slug": "my-community"
  },
  "tags": [ ... ],
  "reactions": {
    "like": 5,
    "love": 2
  },
  "comments": [
    {
      "id": "comment_1",
      "content": "Great post!",
      "author": { ... },
      "reactions": { "like": 1 },
      "replies": [
        {
          "id": "comment_2",
          "content": "Thanks!",
          "author": { ... },
          "replies": []
        }
      ]
    }
  ],
  "commentCount": 2
}
```

#### Update Post

**PATCH** `/api/posts/:id`

Update an existing post.

**Headers:**
- `x-user-id`: User ID (required)

**Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "type": "question",
  "tags": [
    { "name": "help", "color": "#ef4444" }
  ]
}
```

**Rules:**
- Authors can edit within 15 minutes of creation
- Moderators can edit anytime
- Only moderators can change `isPinned`
- All fields are optional

**Response:** (200 OK)
```json
{
  "id": "post_123",
  "title": "Updated Title",
  ...
}
```

#### Delete Post

**DELETE** `/api/posts/:id`

Delete a post and all associated comments, reactions, and tags.

**Headers:**
- `x-user-id`: User ID (required)

**Rules:**
- Only the post author or community moderators can delete
- Cascade deletes all comments, reactions, and tags

**Response:** (200 OK)
```json
{
  "message": "Post deleted successfully"
}
```

---

### Comments

#### List Comments for Post

**GET** `/api/posts/:id/comments`

Get all comments for a post (flat list, use nesting on client side).

**Response:**
```json
{
  "comments": [
    {
      "id": "comment_1",
      "postId": "post_123",
      "parentCommentId": null,
      "content": "Great post!",
      "author": {
        "id": "user_123",
        "name": "John Doe",
        "avatar": "https://...",
        "role": "member"
      },
      "reactions": {
        "like": 3
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Create Comment

**POST** `/api/posts/:id/comments`

Add a comment to a post.

**Headers:**
- `x-user-id`: User ID (required)

**Body:**
```json
{
  "content": "This is my comment...",
  "parentCommentId": "comment_1"  // Optional, for nested replies
}
```

**Rules:**
- Maximum nesting depth: 3 levels
- User must be a member of the community
- Creates notifications for post author and parent comment author

**Response:** (201 Created)
```json
{
  "id": "comment_2",
  "content": "This is my comment...",
  "parentCommentId": "comment_1",
  "author": { ... },
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Reactions

#### Get Reactions for Post

**GET** `/api/posts/:id/reactions`

Get all reactions for a post, grouped by type.

**Response:**
```json
{
  "reactions": {
    "like": [
      {
        "userId": "user_1",
        "user": {
          "id": "user_1",
          "name": "John Doe",
          "avatar": "https://..."
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "love": [ ... ],
    "celebrate": [ ... ],
    "insightful": [ ... ]
  },
  "counts": {
    "like": 5,
    "love": 2,
    "celebrate": 1,
    "insightful": 3
  },
  "total": 11
}
```

#### Toggle Reaction

**POST** `/api/posts/:id/reactions`

Add or remove a reaction (toggle behavior).

**Headers:**
- `x-user-id`: User ID (required)

**Body:**
```json
{
  "reactionType": "like"
}
```

**Valid Reaction Types:**
- `like`
- `love`
- `celebrate`
- `insightful`

**Rules:**
- One reaction type per user per post
- If reaction exists, it will be removed (toggle off)
- If reaction doesn't exist, it will be added
- Creates notification for post author

**Response:**
```json
{
  "action": "added",  // or "removed"
  "reactionType": "like",
  "counts": {
    "like": 6,
    "love": 2
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "error": "Title and content are required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "error": "Not a member of this community"
}
```

**404 Not Found:**
```json
{
  "error": "Post not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create post"
}
```

---

## Database Models

### Post
- `id`: Unique identifier
- `communityId`: Foreign key to Community
- `authorId`: Foreign key to User
- `title`: Post title
- `content`: Post content (text)
- `type`: `discussion`, `question`, or `announcement`
- `isPinned`: Boolean, moderators only
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### Comment
- `id`: Unique identifier
- `postId`: Foreign key to Post
- `authorId`: Foreign key to User
- `parentCommentId`: Foreign key to Comment (nullable, for nesting)
- `content`: Comment content (text)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### Reaction
- `id`: Unique identifier
- `reactableType`: `post` or `comment` (polymorphic)
- `reactableId`: ID of post or comment
- `userId`: Foreign key to User
- `reactionType`: `like`, `love`, `celebrate`, or `insightful`
- `createdAt`: Timestamp

### PostTag
- `id`: Unique identifier
- `postId`: Foreign key to Post
- `name`: Tag name
- `color`: Hex color code

---

## Notifications

The API automatically creates notifications for:

1. **Comment on post**: When someone comments on your post
2. **Reply to comment**: When someone replies to your comment
3. **Reaction**: When someone reacts to your post

Notifications include:
- `type`: Event type
- `message`: Human-readable message
- `actionUrl`: Link to the relevant post/comment
- `isRead`: Boolean flag

---

## Testing Examples

### Create a post
```bash
curl -X POST http://localhost:3000/api/communities/comm_123/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "title": "Test Post",
    "content": "This is a test",
    "type": "discussion",
    "tags": [{"name": "test"}]
  }'
```

### Add a comment
```bash
curl -X POST http://localhost:3000/api/posts/post_123/comments \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_456" \
  -d '{
    "content": "Great post!"
  }'
```

### React to a post
```bash
curl -X POST http://localhost:3000/api/posts/post_123/reactions \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_789" \
  -d '{
    "reactionType": "like"
  }'
```

### List posts with filters
```bash
curl "http://localhost:3000/api/communities/comm_123/posts?page=1&limit=10&type=question&tag=help" \
  -H "x-user-id: user_123"
```

---

## Next Steps

**Frontend Integration:**
1. Create React hooks for data fetching
2. Build UI components for posts, comments, reactions
3. Implement real-time updates (WebSocket/polling)
4. Add optimistic UI updates

**Authentication:**
1. Replace `x-user-id` header with JWT tokens
2. Implement session management
3. Add role-based access control middleware

**Features to Add:**
1. Post editing history
2. Comment editing (with 5-min window)
3. User mentions (@username)
4. File attachments
5. Rich text formatting
