# Week 1 Community Feed - Component Usage Examples

## 📝 Component Import Examples

### Basic Setup
```tsx
import CommunityFeed from '@/components/community/CommunityFeed';
import PostCard from '@/components/community/PostCard';
import ReactionButton from '@/components/community/ReactionButton';
import CommunityLayout from '@/components/community/CommunityLayout';
import CreatePostModal from '@/components/community/CreatePostModal';
import CommentSection from '@/components/community/CommentSection';
```

---

## 🎨 Component Usage Examples

### Example 1: Basic Community Feed
```tsx
'use client';

import { useState } from 'react';
import CommunityFeed from '@/components/community/CommunityFeed';
import CommunityLayout from '@/components/community/CommunityLayout';

export default function CommunityPage() {
  const community = {
    id: 'mautic-users',
    name: 'Mautic Users Community',
    description: 'Connect with Mautic professionals and learn together',
    slug: 'mautic-users',
    memberCount: 1250,
    postCount: 842,
  };

  return (
    <CommunityLayout community={community}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CommunityFeed
          communityId={community.id}
          communitySlug={community.slug}
        />
      </div>
    </CommunityLayout>
  );
}
```

---

### Example 2: Custom Post Card with Reactions
```tsx
import PostCard from '@/components/community/PostCard';

const post = {
  id: 'post-123',
  title: 'How to set up email marketing automation?',
  content: 'I\'m trying to create an email automation workflow that sends emails based on user behavior. Here\'s what I\'ve tried so far...',
  author: {
    id: 'user-1',
    name: 'Sarah Johnson',
    avatar: 'SJ',
    role: 'Expert',
  },
  createdAt: new Date().toISOString(),
  reactions: {
    like: 23,
    love: 5,
    celebrate: 2,
    insightful: 8,
  },
  commentCount: 4,
  tags: ['automation', 'email-marketing', 'workflows'],
  type: 'question' as const,
  isPinned: false,
};

function handleReaction(postId: string, reactionType: string) {
  console.log(`User reacted ${reactionType} to post ${postId}`);
  // Call API to save reaction
}

export default function ExamplePost() {
  return (
    <PostCard
      post={post}
      onReact={handleReaction}
    />
  );
}
```

---

### Example 3: Standalone Reaction Button
```tsx
import ReactionButton from '@/components/community/ReactionButton';
import { useState } from 'react';

export default function ReactionExample() {
  const [likeCount, setLikeCount] = useState(23);

  const handleLike = () => {
    setLikeCount(likeCount + 1);
    // Call API to save
  };

  return (
    <div className="flex gap-4">
      {/* Standard size */}
      <ReactionButton
        type="like"
        count={likeCount}
        onReact={handleLike}
      />

      {/* Compact size */}
      <ReactionButton
        type="love"
        count={5}
        onReact={() => console.log('loved')}
        compact
      />

      {/* All reaction types */}
      <ReactionButton type="celebrate" count={2} onReact={() => {}} />
      <ReactionButton type="insightful" count={8} onReact={() => {}} />
    </div>
  );
}
```

---

### Example 4: Filter and Sort Implementation
```tsx
'use client';

import { useState, useEffect } from 'react';
import PostCard from '@/components/community/PostCard';

export default function FilteredFeed() {
  const [filterType, setFilterType] = useState<'all' | 'questions' | 'announcements'>('all');
  const [sortType, setSortType] = useState<'recent' | 'oldest' | 'popular'>('recent');
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // Build query string
    const params = new URLSearchParams();
    if (filterType !== 'all') {
      params.set('type', filterType === 'questions' ? 'question' : 'announcement');
    }
    params.set('sort', sortType);

    // Fetch posts
    fetch(`/api/community/mautic-users/posts?${params.toString()}`)
      .then(res => res.json())
      .then(data => setPosts(data.posts));
  }, [filterType, sortType]);

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Questions', value: 'questions' },
          { label: 'Announcements', value: 'announcements' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilterType(tab.value as any)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filterType === tab.value
                ? 'bg-accent-cyan text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort Dropdown */}
      <select
        value={sortType}
        onChange={(e) => setSortType(e.target.value as any)}
        className="px-4 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary"
      >
        <option value="recent">Recent</option>
        <option value="oldest">Oldest</option>
        <option value="popular">Most Popular</option>
      </select>

      {/* Posts List */}
      <div className="space-y-4">
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onReact={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### Example 5: Create Post Modal Integration
```tsx
'use client';

import { useState } from 'react';
import CreatePostModal from '@/components/community/CreatePostModal';

export default function CreatePostExample() {
  const [showModal, setShowModal] = useState(false);

  const handleSuccess = () => {
    console.log('Post created successfully!');
    setShowModal(false);
    // Refresh feed
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-6 py-2 bg-accent-cyan text-white rounded-lg font-medium hover:bg-accent-cyan/90"
      >
        Create Post
      </button>

      {showModal && (
        <CreatePostModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          communitySlug="mautic-users"
        />
      )}
    </>
  );
}
```

---

### Example 6: Comment Section Integration
```tsx
import CommentSection from '@/components/community/CommentSection';

export default function PostDetailPage({ postId }: { postId: string }) {
  return (
    <div>
      {/* Post content */}
      <article className="mb-8">
        {/* Post details */}
      </article>

      {/* Comments section */}
      <CommentSection
        postId={postId}
        onCommentAdded={() => {}}
      />
    </div>
  );
}
```

---

## 🎯 Real-World Scenarios

### Scenario 1: Building a Custom Community Header
```tsx
'use client';

import { useEffect, useState } from 'react';

interface Community {
  name: string;
  description: string;
  _count: {
    members: number;
    posts: number;
    courses: number;
    events: number;
  };
}

export default function CommunityHeader({ slug }: { slug: string }) {
  const [community, setCommunity] = useState<Community | null>(null);

  useEffect(() => {
    fetch(`/api/community/${slug}`)
      .then(r => r.json())
      .then(setCommunity);
  }, [slug]);

  if (!community) return <div>Loading...</div>;

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 mb-6">
      <h1 className="text-3xl font-bold text-text-primary mb-2">
        {community.name}
      </h1>
      <p className="text-text-secondary mb-4">
        {community.description}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-bg-tertiary rounded-lg">
          <div className="text-2xl font-bold text-accent-cyan">
            {community._count.members}
          </div>
          <div className="text-sm text-text-muted">Members</div>
        </div>
        <div className="text-center p-4 bg-bg-tertiary rounded-lg">
          <div className="text-2xl font-bold text-accent-green">
            {community._count.posts}
          </div>
          <div className="text-sm text-text-muted">Posts</div>
        </div>
        <div className="text-center p-4 bg-bg-tertiary rounded-lg">
          <div className="text-2xl font-bold text-accent-purple">
            {community._count.courses}
          </div>
          <div className="text-sm text-text-muted">Courses</div>
        </div>
        <div className="text-center p-4 bg-bg-tertiary rounded-lg">
          <div className="text-2xl font-bold text-accent-yellow">
            {community._count.events}
          </div>
          <div className="text-sm text-text-muted">Events</div>
        </div>
      </div>
    </div>
  );
}
```

---

### Scenario 2: Handling Reactions with Toast Notification
```tsx
'use client';

import { useState } from 'react';
import PostCard from '@/components/community/PostCard';
import { Post } from '@/types/community';

export default function PostWithNotifications({ post }: { post: Post }) {
  const [notification, setNotification] = useState('');

  const handleReact = async (postId: string, reactionType: string) => {
    try {
      const res = await fetch(
        `/api/community/mautic-users/posts/${postId}/reactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactionType }),
        }
      );

      if (res.ok) {
        setNotification(`You reacted with ${reactionType}!`);
        setTimeout(() => setNotification(''), 3000);
      }
    } catch (error) {
      setNotification('Failed to add reaction. Try again.');
      setTimeout(() => setNotification(''), 3000);
    }
  };

  return (
    <>
      <PostCard post={post} onReact={handleReact} />

      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-accent-cyan text-white px-6 py-3 rounded-lg animate-fade-in">
          {notification}
        </div>
      )}
    </>
  );
}
```

---

### Scenario 3: Infinite Scroll Implementation
```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PostCard from '@/components/community/PostCard';

export default function InfiniteScrollFeed() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observerTarget = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/community/mautic-users/posts?page=${page}&limit=20`
      );
      const data = await res.json();

      setPosts(prev => [...prev, ...data.posts]);
      setPage(prev => prev + 1);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <PostCard key={post.id} post={post} onReact={() => {}} />
      ))}

      {hasMore && (
        <div ref={observerTarget} className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto"></div>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 Color Usage Examples

### Using Post Type Colors
```tsx
// Question - Purple
className="bg-accent-purple/10 text-accent-purple border-accent-purple/30"

// Announcement - Orange/Yellow
className="bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30"

// Resource - Green
className="bg-accent-green/10 text-accent-green border-accent-green/30"

// Discussion - Cyan
className="bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30"
```

---

### Using Reaction Colors
```tsx
// Like - Cyan
className="bg-accent-cyan/10 text-accent-cyan"

// Love - Red
className="bg-accent-red/10 text-accent-red"

// Celebrate - Yellow
className="bg-accent-yellow/10 text-accent-yellow"

// Insightful - Purple
className="bg-accent-purple/10 text-accent-purple"
```

---

## 🔄 State Management Patterns

### Lifting State Up
```tsx
'use client';

import { useState, useCallback } from 'react';
import CommunityFeed from '@/components/community/CommunityFeed';

export default function CommunityPageContainer() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePostCreated = useCallback(() => {
    // Force feed refresh by changing key
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <CommunityFeed
      key={refreshKey}
      communityId="mautic-users"
      communitySlug="mautic-users"
      onPostCreated={handlePostCreated}
    />
  );
}
```

---

### Context-Based State
```tsx
import { createContext, useContext } from 'react';

const CommunityContext = createContext<{
  communityId: string;
  slug: string;
}>({ communityId: '', slug: '' });

export function CommunityProvider({ children, communityId, slug }) {
  return (
    <CommunityContext.Provider value={{ communityId, slug }}>
      {children}
    </CommunityContext.Provider>
  );
}

// Use in components
function MyComponent() {
  const { communityId, slug } = useContext(CommunityContext);
  return <div>{slug}</div>;
}
```

---

## 📊 Data Transformation Examples

### Processing Raw API Data
```tsx
interface RawPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author: { name: string; };
  createdAt: string;
}

function transformPost(raw: RawPost): Post {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    author: {
      id: raw.authorId,
      name: raw.author.name,
      avatar: raw.author.name.charAt(0).toUpperCase(),
      role: 'Member', // Get from user profile
    },
    createdAt: raw.createdAt,
    reactions: { like: 0, love: 0, celebrate: 0, insightful: 0 },
    commentCount: 0,
    tags: [],
    type: 'discussion',
  };
}
```

---

## ✨ Animation & Interaction Examples

### Loading Animation
```tsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan">
  {/* Spinning loader */}
</div>
```

### Fade In Animation
```tsx
<div className="animate-fade-in">Content appears with fade</div>
```

### Hover Effects
```tsx
<button className="hover:bg-accent-cyan/90 transition-all duration-200">
  Hover me!
</button>
```

### Group Hover
```tsx
<article className="group hover:border-accent-cyan transition-all">
  <h2 className="group-hover:text-accent-cyan">Title</h2>
</article>
```

---

## 🎯 TypeScript Type Examples

### Defining Custom Props
```tsx
interface CustomPostCardProps extends PostCardProps {
  showAuthorBadge?: boolean;
  compact?: boolean;
  onShare?: (postId: string) => void;
}

function CustomPostCard({
  post,
  onReact,
  showAuthorBadge,
  compact,
  onShare,
}: CustomPostCardProps) {
  return (
    <PostCard post={post} onReact={onReact} />
  );
}
```

---

### Union Types for Components
```tsx
type SortOption = 'recent' | 'oldest' | 'popular';
type FilterOption = 'all' | 'questions' | 'announcements';
type ReactionType = 'like' | 'love' | 'celebrate' | 'insightful';
type PostType = 'discussion' | 'question' | 'announcement' | 'resource';
```

---

## 🚀 Performance Optimization Examples

### Memoizing Components
```tsx
import { memo } from 'react';

const PostCard = memo(function PostCard({ post, onReact }: PostCardProps) {
  return <article>{/* post content */}</article>;
});

export default PostCard;
```

### Lazy Loading
```tsx
import { lazy, Suspense } from 'react';

const CommunityFeed = lazy(() => import('@/components/community/CommunityFeed'));

export default function Page() {
  return (
    <Suspense fallback={<div>Loading feed...</div>}>
      <CommunityFeed communityId="mautic-users" communitySlug="mautic-users" />
    </Suspense>
  );
}
```

---

## 📚 Additional Resources

### Component Files
- `CommunityLayout.tsx` - Main layout wrapper
- `CommunityFeed.tsx` - Feed with filtering/sorting
- `PostCard.tsx` - Individual post display
- `ReactionButton.tsx` - Reaction buttons
- `CreatePostModal.tsx` - Post creation form
- `CommentSection.tsx` - Comment threads

### Documentation Files
- `WEEK1_COMMUNITY_FEED.md` - Comprehensive documentation
- `WEEK1_QUICK_START.md` - Quick reference guide
- `WEEK1_COMPONENT_EXAMPLES.md` - This file (usage examples)

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Complete & Ready for Integration
