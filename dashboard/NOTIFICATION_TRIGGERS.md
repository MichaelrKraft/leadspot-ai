# Notification Triggers - Implementation Guide

This document explains how to create notifications when certain events occur in the Mautic Platform.

## How to Create Notifications

### Basic Pattern

```typescript
import { prisma } from '@/lib/prisma';

// Create a notification
await prisma.notification.create({
  data: {
    userId: targetUserId,        // Who receives the notification
    type: 'comment',              // Type of notification
    message: 'John commented on your post "Getting Started with Mautic"',
    actionUrl: '/community/mautic-users/posts/abc123',  // Where to go when clicked
    isRead: false,
  },
});
```

## Notification Types

### 1. Comment on Post

**When**: Someone comments on a user's post

```typescript
// In /api/posts/[id]/comments/route.ts (or similar)
async function handleNewComment(postId: string, commentAuthorId: string, commentText: string) {
  // Get the post to find the author
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, title: true },
  });

  // Don't notify if commenting on own post
  if (post && post.authorId !== commentAuthorId) {
    const commenter = await prisma.user.findUnique({
      where: { id: commentAuthorId },
      select: { name: true },
    });

    await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: 'comment',
        message: `${commenter?.name || 'Someone'} commented on your post "${post.title}"`,
        actionUrl: `/community/[slug]/posts/${postId}`,
      },
    });
  }
}
```

### 2. Reply to Comment

**When**: Someone replies to a user's comment

```typescript
// In /api/comments/[id]/replies/route.ts
async function handleCommentReply(parentCommentId: string, replyAuthorId: string) {
  const parentComment = await prisma.comment.findUnique({
    where: { id: parentCommentId },
    select: {
      authorId: true,
      postId: true,
      post: { select: { title: true } }
    },
  });

  if (parentComment && parentComment.authorId !== replyAuthorId) {
    const replier = await prisma.user.findUnique({
      where: { id: replyAuthorId },
      select: { name: true },
    });

    await prisma.notification.create({
      data: {
        userId: parentComment.authorId,
        type: 'reply_to_comment',
        message: `${replier?.name || 'Someone'} replied to your comment on "${parentComment.post.title}"`,
        actionUrl: `/community/[slug]/posts/${parentComment.postId}`,
      },
    });
  }
}
```

### 3. Reaction

**When**: Someone reacts to a user's post or comment

```typescript
// In /api/posts/[id]/reactions/route.ts
async function handleReaction(postId: string, reactorId: string, reactionType: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, title: true },
  });

  if (post && post.authorId !== reactorId) {
    const reactor = await prisma.user.findUnique({
      where: { id: reactorId },
      select: { name: true },
    });

    const emoji = reactionType === 'like' ? '👍' :
                  reactionType === 'love' ? '❤️' :
                  reactionType === 'celebrate' ? '🎉' : '💡';

    await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: 'reaction',
        message: `${reactor?.name || 'Someone'} reacted ${emoji} to your post "${post.title}"`,
        actionUrl: `/community/[slug]/posts/${postId}`,
      },
    });
  }
}
```

### 4. Mention

**When**: Someone mentions a user with @username

```typescript
// In post/comment creation endpoint
async function handleMentions(content: string, postId: string, authorId: string) {
  // Extract @mentions from content (simple regex - enhance as needed)
  const mentions = content.match(/@(\w+)/g);

  if (mentions) {
    const usernames = mentions.map(m => m.slice(1)); // Remove @

    // Find users by name
    const users = await prisma.user.findMany({
      where: {
        name: { in: usernames },
        id: { not: authorId }, // Don't notify self
      },
      select: { id: true, name: true },
    });

    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { name: true },
    });

    // Create notification for each mentioned user
    for (const user of users) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'mention',
          message: `${author?.name || 'Someone'} mentioned you in a post`,
          actionUrl: `/community/[slug]/posts/${postId}`,
        },
      });
    }
  }
}
```

### 5. Achievement Unlocked

**When**: User earns an achievement (triggered by achievement system)

```typescript
// In achievement service
async function awardAchievement(userId: string, achievementId: string) {
  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId },
    select: { name: true, description: true, pointsValue: true },
  });

  if (achievement) {
    // Award the achievement
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'achievement',
        message: `Achievement unlocked: ${achievement.name}! (+${achievement.pointsValue} points)`,
        actionUrl: `/community/[slug]/profile/${userId}/achievements`,
      },
    });
  }
}
```

### 6. Event Reminder

**When**: Event is starting soon (triggered by cron job)

```typescript
// In a cron job or scheduled task
async function sendEventReminders() {
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  const now = new Date();

  // Find events starting in the next hour
  const upcomingEvents = await prisma.event.findMany({
    where: {
      startTime: {
        gte: now,
        lte: oneHourFromNow,
      },
    },
    include: {
      attendees: {
        where: { status: 'registered' },
        select: { userId: true },
      },
    },
  });

  // Create notifications for all registered attendees
  for (const event of upcomingEvents) {
    for (const attendee of event.attendees) {
      await prisma.notification.create({
        data: {
          userId: attendee.userId,
          type: 'event_reminder',
          message: `Event starting in 1 hour: ${event.title}`,
          actionUrl: `/community/[slug]/events/${event.id}`,
        },
      });
    }
  }
}
```

## Best Practices

### 1. Batch Notifications

For bulk operations (like event reminders), use batch creation:

```typescript
const notifications = attendees.map(attendee => ({
  userId: attendee.userId,
  type: 'event_reminder',
  message: `Event starting soon: ${event.title}`,
  actionUrl: `/community/[slug]/events/${event.id}`,
}));

await prisma.notification.createMany({
  data: notifications,
});
```

### 2. Don't Spam Users

- Don't notify users about their own actions
- Consider grouping similar notifications
- Add user preferences for notification types (future enhancement)

### 3. Clean Up Old Notifications

Periodically delete old read notifications to keep database lean:

```typescript
// Delete read notifications older than 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

await prisma.notification.deleteMany({
  where: {
    isRead: true,
    createdAt: { lt: thirtyDaysAgo },
  },
});
```

### 4. Notification Preferences (Future)

Consider adding a user preferences table:

```prisma
model NotificationPreferences {
  id                  String  @id @default(cuid())
  userId              String  @unique
  emailNotifications  Boolean @default(true)
  pushNotifications   Boolean @default(true)
  notifyOnComment     Boolean @default(true)
  notifyOnReaction    Boolean @default(true)
  notifyOnMention     Boolean @default(true)
  notifyOnAchievement Boolean @default(true)
  notifyOnEvent       Boolean @default(true)
  user                User    @relation(fields: [userId], references: [id])
}
```

## Integration Checklist

To fully integrate notifications:

- [ ] Add notification creation to post comment API
- [ ] Add notification creation to reaction API
- [ ] Implement @mention detection in post/comment creation
- [ ] Create achievement award service with notifications
- [ ] Set up cron job for event reminders
- [ ] Add notification creation when course lesson unlocks
- [ ] Create notification cleanup cron job
- [ ] Add user notification preferences page
- [ ] Consider email notifications for important events
- [ ] Add push notifications (future enhancement)
