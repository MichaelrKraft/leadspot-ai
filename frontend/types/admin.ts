// Admin TypeScript Types

export type UserRole = 'admin' | 'user' | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'pending';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  createdAt: string;
  lastActiveAt?: string;
  organizationId: string;
}

export interface InviteUserPayload {
  email: string;
  role: UserRole;
}

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  maxUsers: number;
  maxDocuments: number;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.invited'
  | 'user.login'
  | 'document.uploaded'
  | 'document.deleted'
  | 'query.executed'
  | 'settings.updated';

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userEmail: string;
  timestamp: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export interface UsageStats {
  totalUsers: number;
  activeUsers: number;
  totalQueries: number;
  totalDocuments: number;
  queriesThisMonth: number;
  newUsersThisMonth: number;
}

export interface QueryVolumeData {
  date: string;
  count: number;
}

export interface UserActivityData {
  userId: string;
  userName: string;
  queryCount: number;
}

export interface AnalyticsData {
  queryVolume: QueryVolumeData[];
  activeUsers: { date: string; count: number }[];
  topUsers: UserActivityData[];
  documentGrowth: { date: string; count: number }[];
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    pending: number;
  };
  queries: {
    total: number;
    today: number;
    thisWeek: number;
  };
  documents: {
    total: number;
    thisMonth: number;
  };
  storage: {
    used: number;
    limit: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'user_joined' | 'document_added' | 'query_executed' | 'user_invited';
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}
