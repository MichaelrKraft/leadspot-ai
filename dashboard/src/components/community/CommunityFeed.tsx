'use client';

import { useState, useEffect } from 'react';
import PostCard from './PostCard';
import CreatePostModal from './CreatePostModal';

interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
  createdAt: string;
  reactions: {
    like: number;
    love: number;
    celebrate: number;
    insightful: number;
  };
  commentCount: number;
  tags: string[];
  type: 'discussion' | 'question' | 'announcement' | 'resource';
  isPinned?: boolean;
}

interface CommunityFeedProps {
  communityId: string;
  communitySlug: string;
}

type FilterType = 'all' | 'questions' | 'announcements';
type SortType = 'recent' | 'oldest' | 'popular';

export default function CommunityFeed({ communityId, communitySlug }: CommunityFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('recent');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch posts from API
  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams();
        if (filterType !== 'all') {
          // Convert filter type to post type
          const typeMap = {
            questions: 'question',
            announcements: 'announcement',
          };
          queryParams.set('type', typeMap[filterType as keyof typeof typeMap]);
        }
        queryParams.set('sort', sortType);

        const res = await fetch(`/api/community/${communitySlug}/posts?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to fetch posts');
        }

        const data = await res.json();
        setPosts(data.posts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [communitySlug, filterType, sortType]);

  const handleReact = async (postId: string, reactionType: string) => {
    try {
      const res = await fetch(`/api/community/${communitySlug}/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType }),
      });

      if (!res.ok) throw new Error('Failed to add reaction');

      const updatedPost = await res.json();
      setPosts(posts.map(p => (p.id === postId ? updatedPost : p)));
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
    setShowCreateModal(false);
  };

  // Filter tabs
  const filterTabs = [
    { label: 'All', value: 'all' as FilterType },
    { label: 'Questions', value: 'questions' as FilterType },
    { label: 'Announcements', value: 'announcements' as FilterType },
  ];

  // Sort options
  const sortOptions = [
    { label: 'Recent', value: 'recent' as SortType },
    { label: 'Oldest', value: 'oldest' as SortType },
    { label: 'Most Popular', value: 'popular' as SortType },
  ];

  return (
    <div className="space-y-6">
      {/* Create Post Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-accent-cyan text-white rounded-lg font-medium hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Post
        </button>
      </div>

      {/* Filter and Sort Controls */}
      <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
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
        <div className="w-full sm:w-auto">
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            className="w-full px-4 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent-cyan transition-colors"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading posts...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4">
          <p className="text-accent-red font-medium">Error loading posts</p>
          <p className="text-accent-red/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && posts.length === 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
          <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-text-primary font-semibold text-lg mb-2">No posts yet</h3>
          <p className="text-text-secondary mb-4">Be the first to start a discussion in this community!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-accent-cyan text-white rounded-lg font-medium hover:bg-accent-cyan/90 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create First Post
          </button>
        </div>
      )}

      {/* Posts List */}
      {!loading && !error && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReact={handleReact}
            />
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          communityId={communityId}
          communitySlug={communitySlug}
          onClose={() => setShowCreateModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
}
