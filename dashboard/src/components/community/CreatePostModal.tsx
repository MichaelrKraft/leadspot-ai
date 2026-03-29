'use client';

import { useState, useRef, useEffect } from 'react';

interface CreatePostModalProps {
  communityId: string;
  communitySlug: string;
  onClose: () => void;
  onPostCreated: (post: any) => void;
}

export default function CreatePostModal({ communityId, communitySlug, onClose, onPostCreated }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'discussion' | 'question' | 'announcement' | 'resource'>('discussion');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!content.trim()) {
      setError('Please enter some content');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/community/${communitySlug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          type,
          tags,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create post');
      }

      const newPost = await response.json();

      // Reset form
      setTitle('');
      setContent('');
      setType('discussion');
      setTags([]);
      setTagInput('');

      onPostCreated(newPost);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Text formatting helpers
  const insertFormatting = (before: string, after: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);

    setContent(newText);

    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary rounded-xl border border-border-subtle max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle sticky top-0 bg-bg-secondary z-10">
          <h2 className="text-xl font-semibold text-text-primary">Create New Post</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Message */}
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4 mb-6">
              <p className="text-accent-red text-sm">{error}</p>
            </div>
          )}

          {/* Post Type */}
          <div className="mb-6">
            <label className="block text-text-primary text-sm font-medium mb-3">Post Type</label>
            <div className="flex flex-wrap gap-3">
              {(['discussion', 'question', 'announcement', 'resource'] as const).map((postType) => (
                <button
                  key={postType}
                  type="button"
                  onClick={() => setType(postType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    type === postType
                      ? 'bg-accent-cyan text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/70'
                  }`}
                >
                  {postType.charAt(0).toUpperCase() + postType.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-text-primary text-sm font-medium mb-2">
              Title <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title..."
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
              maxLength={200}
            />
            <p className="text-text-muted text-xs mt-1">{title.length}/200 characters</p>
          </div>

          {/* Content Editor */}
          <div className="mb-6">
            <label htmlFor="content" className="block text-text-primary text-sm font-medium mb-2">
              Content <span className="text-accent-red">*</span>
            </label>

            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-bg-tertiary border border-border-subtle rounded-t-lg">
              <button
                type="button"
                onClick={() => insertFormatting('**', '**')}
                className="p-2 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary transition-colors"
                title="Bold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('*', '*')}
                className="p-2 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary transition-colors"
                title="Italic"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m-4 4h8m-8 8h8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('`', '`')}
                className="p-2 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary transition-colors"
                title="Code"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </button>
              <div className="w-px h-6 bg-border-subtle mx-1"></div>
              <button
                type="button"
                onClick={() => insertFormatting('\n- ')}
                className="p-2 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary transition-colors"
                title="Bullet List"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('[Link text](', ')')}
                className="p-2 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary transition-colors"
                title="Insert Link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            </div>

            <textarea
              ref={editorRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, ask a question, or provide helpful information..."
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-subtle border-t-0 rounded-b-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors resize-none"
              rows={12}
            />
            <p className="text-text-muted text-xs mt-1">Supports Markdown formatting</p>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label htmlFor="tags" className="block text-text-primary text-sm font-medium mb-2">
              Tags (up to 5)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag and press Enter..."
                className="flex-1 px-4 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
                disabled={tags.length >= 5}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 5}
                className="px-4 py-2 bg-accent-cyan text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-cyan/90 transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 bg-accent-cyan/10 text-accent-cyan text-sm rounded-full"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-accent-red transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-bg-tertiary text-text-primary rounded-lg font-medium hover:bg-bg-tertiary/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="px-6 py-2 bg-accent-cyan text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Post'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
