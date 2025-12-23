import { useState, useEffect } from 'react';
import {
  User,
  AuditLog,
  UsageStats,
  Organization,
  AdminStats,
  RecentActivity,
  AnalyticsData,
} from '@/types/admin';

// Mock data for development
const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    lastActiveAt: '2025-01-15T10:30:00Z',
    organizationId: 'org-1',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2025-01-05T00:00:00Z',
    lastActiveAt: '2025-01-14T14:20:00Z',
    organizationId: 'org-1',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'viewer',
    status: 'pending',
    createdAt: '2025-01-10T00:00:00Z',
    organizationId: 'org-1',
  },
];

const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    action: 'user.login',
    userId: '1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    timestamp: '2025-01-15T10:30:00Z',
    ipAddress: '192.168.1.1',
  },
  {
    id: '2',
    action: 'document.uploaded',
    userId: '2',
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
    timestamp: '2025-01-14T14:20:00Z',
    metadata: { fileName: 'Q4-Report.pdf', size: 2048000 },
  },
  {
    id: '3',
    action: 'query.executed',
    userId: '1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    timestamp: '2025-01-13T09:15:00Z',
    metadata: { query: 'What are our revenue targets?' },
  },
];

const mockOrganization: Organization = {
  id: 'org-1',
  name: 'Acme Corporation',
  plan: 'professional',
  maxUsers: 50,
  maxDocuments: 10000,
  createdAt: '2024-12-01T00:00:00Z',
  updatedAt: '2025-01-10T00:00:00Z',
};

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        // const response = await fetch('/api/admin/users');
        // const data = await response.json();
        await new Promise((resolve) => setTimeout(resolve, 500));
        setUsers(mockUsers);
      } catch (err) {
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return { users, loading, error };
}

export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 300));
        const foundUser = mockUsers.find((u) => u.id === id);
        setUser(foundUser || null);
      } catch (err) {
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchUser();
    }
  }, [id]);

  return { user, loading, error };
}

export function useAuditLogs(filters?: {
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call with filters
        await new Promise((resolve) => setTimeout(resolve, 400));
        setLogs(mockAuditLogs);
      } catch (err) {
        setError('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filters]);

  return { logs, loading, error };
}

export function useUsageStats() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 300));
        setStats({
          totalUsers: 125,
          activeUsers: 87,
          totalQueries: 4523,
          totalDocuments: 1847,
          queriesThisMonth: 1234,
          newUsersThisMonth: 23,
        });
      } catch (err) {
        setError('Failed to load usage stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 300));
        setOrganization(mockOrganization);
      } catch (err) {
        setError('Failed to load organization');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  return { organization, loading, error };
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setStats({
          users: { total: 125, active: 87, pending: 12 },
          queries: { total: 4523, today: 234, thisWeek: 1456 },
          documents: { total: 1847, thisMonth: 342 },
          storage: { used: 45.6, limit: 100 },
        });
      } catch (err) {
        setError('Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

export function useRecentActivity() {
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setActivity([
          {
            id: '1',
            type: 'user_joined',
            description: 'Sarah Connor joined the organization',
            timestamp: '2025-01-15T10:30:00Z',
            userName: 'Sarah Connor',
          },
          {
            id: '2',
            type: 'document_added',
            description: 'New document uploaded: Q4-Report.pdf',
            timestamp: '2025-01-14T14:20:00Z',
            userName: 'Jane Smith',
          },
          {
            id: '3',
            type: 'query_executed',
            description: 'Query executed on financial data',
            timestamp: '2025-01-13T09:15:00Z',
            userName: 'John Doe',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  return { activity, loading };
}

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Generate mock data for charts
        const queryVolume = Array.from({ length: 30 }, (_, i) => ({
          date: new Date(2025, 0, i + 1).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 100) + 50,
        }));

        const activeUsers = Array.from({ length: 30 }, (_, i) => ({
          date: new Date(2025, 0, i + 1).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 40) + 30,
        }));

        const topUsers = [
          { userId: '1', userName: 'John Doe', queryCount: 456 },
          { userId: '2', userName: 'Jane Smith', queryCount: 342 },
          { userId: '3', userName: 'Bob Johnson', queryCount: 278 },
          { userId: '4', userName: 'Alice Brown', queryCount: 234 },
          { userId: '5', userName: 'Charlie Davis', queryCount: 189 },
        ];

        const documentGrowth = Array.from({ length: 12 }, (_, i) => ({
          date: new Date(2024, i, 1).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 200) + 100 * (i + 1),
        }));

        setAnalytics({
          queryVolume,
          activeUsers,
          topUsers,
          documentGrowth,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return { analytics, loading };
}
