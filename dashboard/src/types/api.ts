/**
 * API Types for Community Feed Feature
 * Used across API routes and frontend components
 */

// Post types
export type PostType = 'discussion' | 'question' | 'announcement';

export interface PostTag {
  id: string;
  name: string;
  color: string;
}

export interface PostAuthor {
  id: string;
  name: string | null;
  avatar: string | null;
  role: string;
}

export interface Post {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  content: string;
  type: PostType;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthor;
  tags: PostTag[];
  reactions?: Record<string, number>;
  commentCount?: number;
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthor;
  reactions?: Record<string, number>;
  replies?: Comment[];
}

// Reaction types
export type ReactionType = 'like' | 'love' | 'celebrate' | 'insightful';

export interface Reaction {
  id: string;
  reactableType: 'post' | 'comment';
  reactableId: string;
  userId: string;
  reactionType: ReactionType;
  createdAt: Date;
}

export interface ReactionWithUser extends Reaction {
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

// API Request types
export interface CreatePostRequest {
  title: string;
  content: string;
  type?: PostType;
  isPinned?: boolean;
  tags?: Array<{ name: string; color?: string }>;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  type?: PostType;
  isPinned?: boolean;
  tags?: Array<{ name: string; color?: string }>;
}

export interface CreateCommentRequest {
  content: string;
  parentCommentId?: string;
}

export interface ToggleReactionRequest {
  reactionType: ReactionType;
}

// API Response types
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PostListResponse {
  posts: Post[];
  pagination: PaginationMeta;
}

export interface PostDetailResponse extends Post {
  comments: Comment[];
  commentCount: number;
}

export interface CommentListResponse {
  comments: Comment[];
}

export interface ReactionListResponse {
  reactions: Record<string, ReactionWithUser[]>;
  counts: Record<string, number>;
  total: number;
}

export interface ReactionToggleResponse {
  action: 'added' | 'removed';
  reactionType: ReactionType;
  counts: Record<string, number>;
}

// Error response
export interface APIError {
  error: string;
  details?: Record<string, unknown> | string | null;
}
