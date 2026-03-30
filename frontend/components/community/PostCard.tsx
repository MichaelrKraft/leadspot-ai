'use client';

import { useState } from 'react';
import { MessageSquare, Pin } from 'lucide-react';
import type { CommunityPost } from '@/lib/community-demo-data';
import ReactionButton from './ReactionButton';

interface PostCardProps {
  post: CommunityPost;
  onReact: (postId: string, reactionType: string) => void;
  onToggleComments: (postId: string) => void;
  isCommentsOpen: boolean;
}

const TYPE_STYLES: Record<
  CommunityPost['type'],
  { bg: string; text: string; border: string; label: string }
> = {
  discussion: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    label: 'Discussion',
  },
  question: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    label: 'Question',
  },
  tip: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    label: 'Tip',
  },
  win: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    label: 'Win',
  },
};

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

export default function PostCard({
  post,
  onReact,
  onToggleComments,
  isCommentsOpen,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);

  const typeStyle = TYPE_STYLES[post.type];
  const initial = post.authorName.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(post.authorName);
  const isLong = post.content.length > 300;
  const displayContent =
    isLong && !expanded ? post.content.substring(0, 300) + '...' : post.content;

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md overflow-hidden">
      {/* Pinned banner */}
      {post.isPinned && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2">
          <Pin className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">
            Pinned Post
          </span>
        </div>
      )}

      <div className="p-6">
        {/* Header: avatar + author + time + type badge */}
        <div className="mb-4 flex items-start gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor}`}
          >
            {initial}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">
                {post.authorName}
              </span>
              <span className="text-slate-300">&#183;</span>
              <span className="text-sm text-slate-500">
                {formatTimeAgo(post.createdAt)}
              </span>
              {post.authorRole && (
                <>
                  <span className="text-slate-300">&#183;</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {post.authorRole}
                  </span>
                </>
              )}
            </div>

            {/* Type badge */}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
            >
              {typeStyle.label}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          {post.title}
        </h2>

        {/* Content */}
        <div className="mb-4 text-sm leading-relaxed text-slate-600">
          <p className="whitespace-pre-wrap">{displayContent}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: reactions + comments */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {post.reactions.map((reaction) => (
              <ReactionButton
                key={reaction.type}
                type={reaction.type}
                count={reaction.count}
                reacted={reaction.reacted}
                onToggle={(rType) => onReact(post.id, rType)}
              />
            ))}
          </div>

          <button
            onClick={() => onToggleComments(post.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isCommentsOpen
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>{post.commentCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
