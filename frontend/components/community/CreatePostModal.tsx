'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CommunityPost } from '@/lib/community-demo-data';

interface CreatePostModalProps {
  onClose: () => void;
  onPostCreated: (post: CommunityPost) => void;
}

const POST_TYPES: { value: CommunityPost['type']; label: string }[] = [
  { value: 'discussion', label: 'Discussion' },
  { value: 'question', label: 'Question' },
  { value: 'tip', label: 'Tip' },
  { value: 'win', label: 'Win' },
];

export default function CreatePostModal({
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<CommunityPost['type']>('discussion');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    if (!content.trim()) {
      setError('Please enter some content.');
      return;
    }

    const newPost: CommunityPost = {
      id: `post-new-${Date.now()}`,
      authorName: 'You',
      authorRole: 'Member',
      type,
      title: title.trim(),
      content: content.trim(),
      tags,
      reactions: [
        { type: 'like', count: 0, reacted: false },
        { type: 'love', count: 0, reacted: false },
        { type: 'celebrate', count: 0, reacted: false },
        { type: 'insightful', count: 0, reacted: false },
      ],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };

    onPostCreated(newPost);
  }

  function handleAddTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-6 py-4 rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Create New Post
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Post type selector */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
              Post Type
            </label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setType(pt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    type === pt.value
                      ? 'bg-indigo-500 text-white'
                      : 'border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-5">
            <label
              htmlFor="post-title"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="Enter a descriptive title..."
              className="w-full rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-4 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-colors"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              {title.length}/200 characters
            </p>
          </div>

          {/* Content */}
          <div className="mb-5">
            <label
              htmlFor="post-content"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="post-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError(null);
              }}
              placeholder="Share your thoughts, ask a question, or describe your win..."
              className="w-full rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-colors resize-none"
              rows={8}
            />
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label
              htmlFor="post-tags"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Tags (up to 5)
            </label>
            <div className="flex gap-2">
              <input
                id="post-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-colors"
                disabled={tags.length >= 5}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 5}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-indigo-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-800/50 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 px-5 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              Create Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
