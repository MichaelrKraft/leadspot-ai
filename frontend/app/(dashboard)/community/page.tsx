'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Users,
  FileText,
  Wifi,
  Trophy,
  Star,
} from 'lucide-react';
import {
  DEMO_POSTS,
  DEMO_COMMENTS,
  COMMUNITY_INFO,
  POPULAR_TAGS,
  TOP_CONTRIBUTORS,
} from '@/lib/community-demo-data';
import type { CommunityPost, CommunityComment } from '@/lib/community-demo-data';
import PostCard from '@/components/community/PostCard';
import CreatePostModal from '@/components/community/CreatePostModal';
import CommentSection from '@/components/community/CommentSection';

type FilterType = 'all' | 'discussion' | 'question' | 'tip' | 'win';
type SortType = 'recent' | 'popular';

const FILTER_TABS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Discussions', value: 'discussion' },
  { label: 'Questions', value: 'question' },
  { label: 'Tips', value: 'tip' },
  { label: 'Wins', value: 'win' },
];

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>(DEMO_POSTS);
  const [comments, setComments] =
    useState<Record<string, CommunityComment[]>>(DEMO_COMMENTS);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(
    null,
  );

  // Filter and sort posts
  const displayPosts = useMemo(() => {
    const filtered =
      filter === 'all' ? posts : posts.filter((p) => p.type === filter);

    // Pinned posts always come first
    const pinned = filtered.filter((p) => p.isPinned);
    const unpinned = filtered.filter((p) => !p.isPinned);

    if (sort === 'recent') {
      unpinned.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      unpinned.sort((a, b) => {
        const totalA = a.reactions.reduce((sum, r) => sum + r.count, 0);
        const totalB = b.reactions.reduce((sum, r) => sum + r.count, 0);
        return totalB - totalA;
      });
    }

    return [...pinned, ...unpinned];
  }, [posts, filter, sort]);

  function handleReact(postId: string, reactionType: string) {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          reactions: post.reactions.map((r) =>
            r.type === reactionType
              ? {
                  ...r,
                  reacted: !r.reacted,
                  count: r.reacted ? r.count - 1 : r.count + 1,
                }
              : r,
          ),
        };
      }),
    );
  }

  function handleToggleComments(postId: string) {
    setOpenCommentsPostId((prev) => (prev === postId ? null : postId));
  }

  function handlePostCreated(newPost: CommunityPost) {
    setPosts((prev) => [newPost, ...prev]);
    setShowCreateModal(false);
  }

  function handleAddComment(postId: string, content: string, parentId?: string) {
    const newComment: CommunityComment = {
      id: `comment-new-${Date.now()}`,
      authorName: 'You',
      authorRole: 'Member',
      content,
      createdAt: new Date().toISOString(),
      reactions: [
        { type: 'like', count: 0, reacted: false },
        { type: 'love', count: 0, reacted: false },
      ],
    };

    setComments((prev) => {
      const existing = prev[postId] || [];

      if (!parentId) {
        return { ...prev, [postId]: [...existing, newComment] };
      }

      // Add as nested reply
      const withReply = existing.map((c) => {
        if (c.id === parentId) {
          return { ...c, replies: [...(c.replies || []), newComment] };
        }
        return c;
      });

      return { ...prev, [postId]: withReply };
    });

    // Increment comment count on the post
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0a0a0d]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Main content area */}
          <div className="min-w-0 flex-1">
            {/* Community header */}
            <div className="mb-6 rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {COMMUNITY_INFO.name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    {COMMUNITY_INFO.description}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-sm text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {COMMUNITY_INFO.memberCount} members
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      {COMMUNITY_INFO.postCount} posts
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <Wifi className="h-4 w-4" />
                      {COMMUNITY_INFO.onlineCount} online
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Post
                </button>
              </div>
            </div>

            {/* Filter + sort bar */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Filter tabs */}
              <div className="flex gap-1.5 overflow-x-auto">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      filter === tab.value
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
                className="rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>

            {/* Posts list */}
            {displayPosts.length > 0 ? (
              <div className="space-y-4">
                {displayPosts.map((post) => (
                  <div key={post.id}>
                    <PostCard
                      post={post}
                      onReact={handleReact}
                      onToggleComments={handleToggleComments}
                      isCommentsOpen={openCommentsPostId === post.id}
                    />
                    {/* Expandable comment section */}
                    {openCommentsPostId === post.id && (
                      <div className="mt-2">
                        <CommentSection
                          comments={comments[post.id] || []}
                          onAddComment={(content, parentId) =>
                            handleAddComment(post.id, content, parentId)
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 py-16 text-center shadow-sm">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-zinc-600" />
                <h3 className="mb-1 text-base font-semibold text-slate-700 dark:text-zinc-300">
                  No posts found
                </h3>
                <p className="mb-4 text-sm text-slate-400 dark:text-zinc-500">
                  Try changing the filter or create the first post.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Post
                </button>
              </div>
            )}
          </div>

          {/* Right sidebar -- hidden on small screens */}
          <aside className="hidden w-72 flex-shrink-0 lg:block">
            <div className="sticky top-8 space-y-5">
              {/* Community stats card */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Community Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                      <Users className="h-4 w-4" />
                      Members
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {COMMUNITY_INFO.memberCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                      <FileText className="h-4 w-4" />
                      Posts
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {COMMUNITY_INFO.postCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-emerald-600">
                      <Wifi className="h-4 w-4" />
                      Online Now
                    </span>
                    <span className="text-sm font-semibold text-emerald-600">
                      {COMMUNITY_INFO.onlineCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Popular tags */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Popular Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TAGS.map((tag) => (
                    <button
                      key={tag}
                      className="rounded-md bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top contributors */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Top Contributors
                </h3>
                <div className="space-y-3">
                  {TOP_CONTRIBUTORS.map((contributor, index) => {
                    const initial = contributor.name.charAt(0);
                    const colors = [
                      'bg-amber-100 text-amber-700',
                      'bg-slate-100 text-slate-600',
                      'bg-orange-100 text-orange-700',
                      'bg-indigo-100 text-indigo-700',
                    ];
                    return (
                      <div
                        key={contributor.name}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${colors[index]}`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {contributor.name}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-zinc-500">
                            {contributor.points} points
                          </p>
                        </div>
                        {index === 0 && (
                          <Trophy className="h-4 w-4 text-amber-500" />
                        )}
                        {index === 1 && (
                          <Star className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Create post modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
}
