'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CommunityComment } from '@/lib/community-demo-data';
import ReactionButton from './ReactionButton';

interface CommentSectionProps {
  comments: CommunityComment[];
  onAddComment: (content: string, parentId?: string) => void;
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-violet-100 text-violet-700',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function SingleComment({
  comment,
  onAddComment,
  isNested = false,
}: {
  comment: CommunityComment;
  onAddComment: (content: string, parentId?: string) => void;
  isNested?: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);
  const [reactions, setReactions] = useState(comment.reactions);

  const initial = comment.authorName.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(comment.authorName);
  const hasReplies = comment.replies && comment.replies.length > 0;

  function handleToggleReaction(reactionType: string) {
    setReactions((prev) =>
      prev.map((r) =>
        r.type === reactionType
          ? {
              ...r,
              reacted: !r.reacted,
              count: r.reacted ? r.count - 1 : r.count + 1,
            }
          : r,
      ),
    );
  }

  function handleSubmitReply() {
    if (!replyText.trim()) return;
    onAddComment(replyText.trim(), comment.id);
    setReplyText('');
    setReplyOpen(false);
  }

  return (
    <div className={isNested ? 'ml-10' : ''}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor}`}
        >
          {initial}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          {/* Comment bubble */}
          <div className="rounded-lg border border-slate-100 dark:border-zinc-800/50 bg-slate-50 dark:bg-zinc-800/50 p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {comment.authorName}
              </span>
              {comment.authorRole && (
                <span className="rounded-full bg-slate-200 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-zinc-400">
                  {comment.authorRole}
                </span>
              )}
              <span className="text-xs text-slate-400 dark:text-zinc-500">
                {formatTimeAgo(comment.createdAt)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-zinc-400">
              {comment.content}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {reactions.map((reaction) => (
                <ReactionButton
                  key={reaction.type}
                  type={reaction.type}
                  count={reaction.count}
                  reacted={reaction.reacted}
                  onToggle={handleToggleReaction}
                  compact
                />
              ))}
            </div>

            {/* Reply button -- only for top-level comments */}
            {!isNested && (
              <button
                onClick={() => setReplyOpen(!replyOpen)}
                className="text-xs font-medium text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Reply
              </button>
            )}

            {/* Toggle replies */}
            {hasReplies && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {showReplies ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {showReplies ? 'Hide' : 'Show'} {comment.replies!.length}{' '}
                {comment.replies!.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Reply input */}
          {replyOpen && (
            <div className="mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="w-full rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 resize-none"
                rows={3}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyText.trim()}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyText('');
                  }}
                  className="rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Nested replies */}
          {hasReplies && showReplies && (
            <div className="mt-3 space-y-3 border-l-2 border-slate-100 dark:border-zinc-800/50 pl-3">
              {comment.replies!.map((reply) => (
                <SingleComment
                  key={reply.id}
                  comment={reply}
                  onAddComment={onAddComment}
                  isNested
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({
  comments,
  onAddComment,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');

  function handleSubmit() {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment('');
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
        Comments ({comments.length})
      </h3>

      {/* Add comment form */}
      <div className="mb-5">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 resize-none"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim()}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Post Comment
          </button>
        </div>
      </div>

      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              onAddComment={onAddComment}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-400 dark:text-zinc-500">
            No comments yet. Be the first to comment!
          </p>
        </div>
      )}
    </div>
  );
}
