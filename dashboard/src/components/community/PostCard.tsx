'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactionButton from './ReactionButton';

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

interface PostCardProps {
  post: Post;
  onReact: (postId: string, reactionType: string) => void;
}

export default function PostCard({ post, onReact }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);

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

  const getTypeColor = (type: Post['type']) => {
    switch (type) {
      case 'question':
        return 'bg-accent-purple/10 text-accent-purple border-accent-purple/30';
      case 'announcement':
        return 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      case 'resource':
        return 'bg-accent-green/10 text-accent-green border-accent-green/30';
      default:
        return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30';
    }
  };

  const getTypeIcon = (type: Post['type']) => {
    switch (type) {
      case 'question':
        return (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        );
      case 'announcement':
        return (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        );
      case 'resource':
        return (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        );
      default:
        return (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        );
    }
  };

  const contentPreview = post.content && post.content.length > 300 && !expanded
    ? post.content.substring(0, 300) + '...'
    : post.content || '';

  return (
    <article className="bg-bg-secondary rounded-xl border border-border-subtle hover:border-border-hover transition-all duration-200 overflow-hidden group">
      {/* Pinned Banner */}
      {post.isPinned && (
        <div className="bg-accent-yellow/10 border-b border-accent-yellow/30 px-6 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-yellow" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" />
          </svg>
          <span className="text-accent-yellow text-sm font-medium">Pinned Post</span>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan font-semibold flex-shrink-0">
            {post.author.avatar}
          </div>

          {/* Author Info & Type Badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-text-primary font-medium">{post.author.name}</h3>
              <span className="text-text-muted text-sm">•</span>
              <span className="text-text-muted text-sm">{formatTimeAgo(post.createdAt)}</span>
              {post.author.role && (
                <>
                  <span className="text-text-muted text-sm">•</span>
                  <span className="px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan text-xs rounded-full">
                    {post.author.role}
                  </span>
                </>
              )}
            </div>

            {/* Type Badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(post.type)}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {getTypeIcon(post.type)}
              </svg>
              {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
            </div>
          </div>
        </div>

        {/* Title */}
        <Link href={`/community/${post.id}`} className="block mb-3 group-hover:text-accent-cyan transition-colors">
          <h2 className="text-xl font-semibold text-text-primary">{post.title}</h2>
        </Link>

        {/* Content */}
        <div className="text-text-secondary mb-4 prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap">{contentPreview}</p>
          {post.content && post.content.length > 300 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-accent-cyan text-sm font-medium hover:underline mt-2"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-bg-tertiary text-text-muted text-xs rounded hover:bg-accent-cyan/10 hover:text-accent-cyan cursor-pointer transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer - Reactions & Comments */}
        <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
          {/* Reactions */}
          <div className="flex items-center gap-2">
            <ReactionButton
              type="like"
              count={post.reactions.like}
              onReact={() => onReact(post.id, 'like')}
            />
            <ReactionButton
              type="love"
              count={post.reactions.love}
              onReact={() => onReact(post.id, 'love')}
            />
            <ReactionButton
              type="celebrate"
              count={post.reactions.celebrate}
              onReact={() => onReact(post.id, 'celebrate')}
            />
            <ReactionButton
              type="insightful"
              count={post.reactions.insightful}
              onReact={() => onReact(post.id, 'insightful')}
            />
          </div>

          {/* Comments */}
          <Link
            href={`/community/${post.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium">{post.commentCount}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
