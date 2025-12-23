'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Users,
  FileText,
  Search,
  Activity,
  TrendingUp,
  Server,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PlatformStats {
  total_organizations: number;
  total_users: number;
  total_documents: number;
  total_queries: number;
  active_orgs_today: number;
  active_users_today: number;
  new_orgs_this_week: number;
  new_users_this_week: number;
  storage_used_mb: number;
}

interface OrganizationSummary {
  organization_id: string;
  name: string;
  domain: string;
  subscription_tier: string;
  user_count: number;
  document_count: number;
  total_queries: number;
  last_activity: string | null;
  created_at: string;
  is_active: boolean;
}

interface AIStatus {
  embedding: {
    provider: string;
    model: string;
    api_key_configured: boolean;
  };
  synthesis: {
    provider: string;
    model: string;
    api_key_configured: boolean;
  };
  ollama_available: boolean;
  status: string;
}

interface DashboardData {
  platform_stats: PlatformStats;
  organizations: OrganizationSummary[];
  ai_provider_status: AIStatus;
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/superadmin/dashboard`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Super admin privileges required.');
        }
        throw new Error('Failed to fetch dashboard data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const filteredOrganizations = data?.organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="font-semibold text-red-700">Access Denied</h3>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.platform_stats;
  const aiStatus = data?.ai_provider_status;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Platform-wide overview and management</p>
        </div>
        <Button onClick={fetchDashboard} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Organizations</p>
                <p className="text-3xl font-bold">{stats?.total_organizations || 0}</p>
                <p className="text-xs text-green-600 mt-1">
                  +{stats?.new_orgs_this_week || 0} this week
                </p>
              </div>
              <Building2 className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-3xl font-bold">{stats?.total_users || 0}</p>
                <p className="text-xs text-green-600 mt-1">
                  +{stats?.new_users_this_week || 0} this week
                </p>
              </div>
              <Users className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Documents</p>
                <p className="text-3xl font-bold">{stats?.total_documents || 0}</p>
              </div>
              <FileText className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Queries</p>
                <p className="text-3xl font-bold">{stats?.total_queries || 0}</p>
              </div>
              <Search className="w-10 h-10 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Active Orgs Today</p>
                <p className="text-2xl font-bold">{stats?.active_orgs_today || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Active Users Today</p>
                <p className="text-2xl font-bold">{stats?.active_users_today || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Server className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Storage Used</p>
                <p className="text-2xl font-bold">
                  {((stats?.storage_used_mb || 0) / 1024).toFixed(2)} GB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Provider Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            AI Provider Status
          </CardTitle>
          <CardDescription>Current AI service configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Embeddings</span>
                {aiStatus?.embedding?.api_key_configured ? (
                  <Badge className="bg-green-100 text-green-700">Cloud</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700">Local</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Provider: {aiStatus?.embedding?.provider || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600">
                Model: {aiStatus?.embedding?.model || 'Unknown'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Synthesis</span>
                {aiStatus?.synthesis?.api_key_configured ? (
                  <Badge className="bg-green-100 text-green-700">Cloud</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700">Local</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Provider: {aiStatus?.synthesis?.provider || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600">
                Model: {aiStatus?.synthesis?.model || 'Unknown'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Ollama</span>
                {aiStatus?.ollama_available ? (
                  <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Available
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Offline
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">Local LLM fallback service</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                All Organizations
              </CardTitle>
              <CardDescription>
                {filteredOrganizations?.length || 0} organizations
              </CardDescription>
            </div>
            <div className="w-64">
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-600">Organization</th>
                  <th className="text-left p-3 font-medium text-gray-600">Domain</th>
                  <th className="text-left p-3 font-medium text-gray-600">Tier</th>
                  <th className="text-center p-3 font-medium text-gray-600">Users</th>
                  <th className="text-center p-3 font-medium text-gray-600">Documents</th>
                  <th className="text-center p-3 font-medium text-gray-600">Queries</th>
                  <th className="text-left p-3 font-medium text-gray-600">Last Activity</th>
                  <th className="text-center p-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrganizations?.map((org) => (
                  <tr key={org.organization_id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <span className="font-medium">{org.name}</span>
                    </td>
                    <td className="p-3 text-gray-600">{org.domain}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          org.subscription_tier === 'enterprise'
                            ? 'border-purple-500 text-purple-500'
                            : org.subscription_tier === 'pro'
                            ? 'border-blue-500 text-blue-500'
                            : 'border-gray-400 text-gray-500'
                        }
                      >
                        {org.subscription_tier || 'free'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">{org.user_count}</td>
                    <td className="p-3 text-center">{org.document_count}</td>
                    <td className="p-3 text-center">{org.total_queries}</td>
                    <td className="p-3 text-gray-500 text-sm">
                      {org.last_activity
                        ? new Date(org.last_activity).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="p-3 text-center">
                      {org.is_active ? (
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {(!filteredOrganizations || filteredOrganizations.length === 0) && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No organizations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
