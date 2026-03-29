'use client';

import { useState, useEffect } from 'react';
import ReactionButton from './ReactionButton';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    role?: string;
  };
  createdAt: string;
  reactions: {
    like: number;
    love: number;
    celebrate: number;
    insightful: number;
  };
  replies?: Comment[];
  parentId?: string;
  depth: number;
}

interface CommentSectionProps {
  postId: string;
  communitySlug: string;
}

export default function CommentSection({ postId, communitySlug }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/community/${communitySlug}/posts/${postId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (parentId?: string) => {
    if (!newComment.trim()) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/community/${communitySlug}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          parentId: parentId || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to post comment');

      setNewComment('');
      setReplyingTo(null);
      await fetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (commentId: string, reactionType: string) => {
    try {
      const response = await fetch(`/api/community/${communitySlug}/posts/${postId}/comments/${commentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reactionType }),
      });

      if (response.ok) {
        // Update comment in local state
        const updateCommentReaction = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                reactions: {
                  ...comment.reactions,
                  [reactionType]: comment.reactions[reactionType as keyof typeof comment.reactions] + 1,
                },
              };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: updateCommentReaction(comment.replies),
              };
            }
            return comment;
          });
        };
        setComments(updateCommentReaction(comments));
      }
    } catch (err) {
      console.error('Failed to react to comment:', err);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const toggleReplies = (commentId: string) => {
    const newExpanded = new Set(expandedReplies);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedReplies(newExpanded);
  };

  const renderComment = (comment: Comment, isNested = false) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const maxDepth = 3; // Max nesting level

    return (
      <div
        key={comment.id}
        className={`${isNested ? 'ml-8 md:ml-12' : ''} ${comment.depth >= maxDepth ? 'ml-0' : ''}`}
      >
        <div className="flex gap-3 group">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan text-sm font-semibold">
              {comment.author.avatar}
            </div>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-bg-tertiary rounded-lg p-3 mb-2">
              {/* Author & Time */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-text-primary font-medium text-sm">{comment.author.name}</span>
                {comment.author.role && (
                  <span className="px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan text-xs rounded-full">
                    {comment.author.role}
                  </span>
                )}
                <span className="text-text-muted text-xs">{formatTimeAgo(comment.createdAt)}</span>
              </div>

              {/* Content */}
              <p className="text-text-secondary text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mb-3">
              {/* Reactions */}
              <div className="flex items-center gap-1">
                <ReactionButton
                  type="like"
                  count={comment.reactions.like}
                  onReact={() => handleReaction(comment.id, 'like')}
                  compact
                />
                <ReactionButton
                  type="love"
                  count={comment.reactions.love}
                  onReact={() => handleReaction(comment.id, 'love')}
                  compact
                />
              </div>

              {/* Reply Button */}
              {comment.depth < maxDepth && (
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-text-muted hover:text-accent-cyan text-xs font-medium transition-colors"
                >
                  Reply
                </button>
              )}

              {/* Show Replies Toggle */}
              {hasReplies && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="text-text-muted hover:text-accent-cyan text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {isExpanded ? 'Hide' : 'Show'} {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {/* Reply Input */}
            {replyingTo === comment.id && (
              <div className="mb-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-cyan resize-none"
                  rows={3}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleSubmitComment(comment.id)}
                    disabled={!newComment.trim() || submitting}
                    className="px-4 py-1.5 bg-accent-cyan text-white text-sm rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-cyan/90 transition-colors"
                  >
                    {submitting ? 'Posting...' : 'Reply'}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setNewComment('');
                    }}
                    className="px-4 py-1.5 bg-bg-tertiary text-text-primary text-sm rounded-lg font-medium hover:bg-bg-tertiary/70 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Nested Replies */}
            {hasReplies && isExpanded && comment.replies && (
              <div className="mt-3 space-y-3 border-l-2 border-border-subtle pl-4">
                {comment.replies.map(reply => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-6">
        Comments ({comments.length})
      </h3>

      {/* Add Comment Form */}
      <div className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-4 py-3 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan resize-none"
          rows={4}
        />
        <div className="flex items-center justify-end mt-3">
          <button
            onClick={() => handleSubmitComment()}
            disabled={!newComment.trim() || submitting}
            className="px-6 py-2 bg-accent-cyan text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-cyan/90 transition-colors"
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4 mb-6">
          <p className="text-accent-red text-sm">{error}</p>
          <button onClick={fetchComments} className="text-accent-cyan underline text-sm mt-2">
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-bg-tertiary rounded-full"></div>
              <div className="flex-1">
                <div className="h-16 bg-bg-tertiary rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comments List */}
      {!loading && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map(comment => renderComment(comment))}
        </div>
      )}

      {/* Empty State */}
      {!loading && comments.length === 0 && !error && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-text-muted text-sm">No comments yet. Be the first to comment!</p>
        </div>
      )}

      {/* Load More */}
      {comments.length > 0 && (
        <div className="mt-6 text-center">
          <button className="text-accent-cyan text-sm font-medium hover:underline">
            Load more comments
          </button>
        </div>
      )}
    </div>
  );
}
