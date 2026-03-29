# Notification Types - Visual Reference

This document shows examples of each notification type and how they appear in the UI.

## Notification Type Matrix

| Type | Icon | Color | Example Message | Action URL |
|------|------|-------|-----------------|------------|
| **comment** | 💬 | Gray | "John Smith commented on your post 'Getting Started'" | `/community/mautic-users/posts/abc123` |
| **reply_to_comment** | 💬 | Gray | "Sarah Johnson replied to your comment on 'Email Tips'" | `/community/mautic-users/posts/def456` |
| **reaction** | ❤️ | Pink | "Mike Chen reacted ❤️ to your post 'Welcome!'" | `/community/mautic-users/posts/ghi789` |
| **mention** | @ | Purple | "Lisa Wong mentioned you in a post" | `/community/mautic-users/posts/jkl012` |
| **achievement** | 🏆 | Yellow | "Achievement unlocked: First Post! (+10 points)" | `/community/mautic-users/profile/user123/achievements` |
| **event_reminder** | 📅 | Blue | "Event starting in 1 hour: Mautic Masterclass" | `/community/mautic-users/events/mno345` |

## Visual States

### Unread Notification
```
┌─────────────────────────────────────────────┐
│ 💬  John Smith commented on your post      │ ← Blue left border
│     "Getting Started with Mautic"          │ ← Light blue bg
│     2 minutes ago                     •    │ ← Blue dot
└─────────────────────────────────────────────┘
```

### Read Notification
```
┌─────────────────────────────────────────────┐
│ 🏆  Achievement unlocked: First Comment!   │ ← No border
│     (+5 points)                            │ ← Normal bg
│     1 day ago                              │ ← No dot
└─────────────────────────────────────────────┘
```

## Notification Bell States

### No Notifications
```
  🔔  ← Just the bell icon, no badge
```

### Unread Notifications (1-9)
```
  🔔  ← Bell icon
  (3) ← Blue badge with count
```

### Unread Notifications (10+)
```
  🔔  ← Bell icon
  9+  ← Blue badge showing "9+"
```

## Dropdown Panel Layout

```
┌────────────────────────────────────────────────┐
│ Notifications              Mark all read      │ ← Header
├────────────────────────────────────────────────┤
│ TODAY                                          │ ← Group label
│ 💬 John commented on...    2 mins ago    •    │
│ ❤️ Sarah reacted to...     15 mins ago   •    │
│                                                │
│ YESTERDAY                                      │ ← Group label
│ @ Mike mentioned you...    1 day ago          │
│ 🏆 Achievement unlocked... 1 day ago          │
│                                                │
│ THIS WEEK                                      │ ← Group label
│ 📅 Event reminder...       3 days ago         │
│                                                │
│ OLDER                                          │ ← Group label
│ 💬 Comment on...          2 weeks ago         │
├────────────────────────────────────────────────┤
│         View all notifications                 │ ← Footer
└────────────────────────────────────────────────┘
```

## Empty State

```
┌────────────────────────────────────────────────┐
│ Notifications                                  │
├────────────────────────────────────────────────┤
│                                                │
│                    🔔                          │
│                                                │
│           No notifications                     │
│           You're all caught up!                │
│                                                │
└────────────────────────────────────────────────┘
```

## Interaction Flow

### 1. User Opens Dropdown
- Click bell icon
- Dropdown slides down with smooth animation
- Shows grouped notifications

### 2. User Clicks Notification
- Notification marked as read (API call)
- Badge count decreases
- User navigates to action URL
- Dropdown closes

### 3. User Clicks "Mark all read"
- Button shows "Marking..." during API call
- All unread notifications marked as read
- Badge disappears
- Notifications lose blue highlighting

### 4. User Clicks Outside
- Dropdown closes with smooth animation
- Bell remains accessible

## Color Codes

### Mautic Dark Theme
- **Background**: `#141414` (cards), `#0a0a0a` (page)
- **Border**: `#2a2a2a` (subtle borders)
- **Text Primary**: `#ffffff` (white)
- **Text Secondary**: `#a0a0a0` (light gray)
- **Text Muted**: `#666666` (darker gray)
- **Accent**: `#00D9FF` (cyan blue)

### Notification-Specific Colors
- **Comment**: `#9ca3af` (gray-400)
- **Reaction**: `#f472b6` (pink-400)
- **Mention**: `#c084fc` (purple-400)
- **Achievement**: `#fbbf24` (yellow-400)
- **Event**: `#60a5fa` (blue-400)

## Relative Time Format

| Time Elapsed | Display |
|--------------|---------|
| < 1 minute | "Just now" |
| 1-59 minutes | "X minute(s) ago" |
| 1-23 hours | "X hour(s) ago" |
| 1-6 days | "X day(s) ago" |
| 7+ days | "Jan 15" or "Jan 15, 2024" |

## Database Records Examples

### Comment Notification
```json
{
  "id": "notif_abc123",
  "userId": "user_xyz789",
  "type": "comment",
  "message": "John Smith commented on your post \"Getting Started with Mautic\"",
  "actionUrl": "/community/mautic-users/posts/post_123",
  "isRead": false,
  "createdAt": "2025-01-13T10:30:00Z"
}
```

### Achievement Notification
```json
{
  "id": "notif_def456",
  "userId": "user_xyz789",
  "type": "achievement",
  "message": "Achievement unlocked: First Post! (+10 points)",
  "actionUrl": "/community/mautic-users/profile/user_xyz789/achievements",
  "isRead": false,
  "createdAt": "2025-01-13T09:15:00Z"
}
```

### Event Reminder Notification
```json
{
  "id": "notif_ghi789",
  "userId": "user_xyz789",
  "type": "event_reminder",
  "message": "Event starting in 1 hour: Mautic Masterclass",
  "actionUrl": "/community/mautic-users/events/event_456",
  "isRead": false,
  "createdAt": "2025-01-13T14:00:00Z"
}
```

## API Response Examples

### GET /api/notifications
```json
{
  "notifications": [
    {
      "id": "notif_1",
      "userId": "user_123",
      "type": "comment",
      "message": "John commented on your post",
      "actionUrl": "/posts/123",
      "isRead": false,
      "createdAt": "2025-01-13T10:30:00Z"
    }
  ],
  "grouped": {
    "today": [ /* today's notifications */ ],
    "yesterday": [ /* yesterday's notifications */ ],
    "thisWeek": [ /* this week's notifications */ ],
    "older": [ /* older notifications */ ]
  },
  "unreadCount": 5
}
```

### PATCH /api/notifications/mark-all-read
```json
{
  "message": "All notifications marked as read",
  "count": 5
}
```
