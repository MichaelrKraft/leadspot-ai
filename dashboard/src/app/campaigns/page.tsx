'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTenantMauticUrl } from '@/hooks/useTenantConfig';

interface MauticCampaign {
  id: number;
  name: string;
  description: string;
  isPublished: boolean;
  dateAdded: string;
  dateModified: string;
  publishUp?: string;
  publishDown?: string;
  events?: Record<string, unknown>;
  leads?: { count: number };
}

interface CampaignsResponse {
  campaigns: MauticCampaign[];
  total: number;
  error?: string;
}

export default function CampaignsPage() {
  const { mauticUrl } = useTenantMauticUrl();
  const [campaigns, setCampaigns] = useState<MauticCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchCampaigns = async (search?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '50');

      const response = await fetch(`/api/mautic/campaigns?${params.toString()}`);
      const data: CampaignsResponse = await response.json();

      if (response.status === 401) {
        setNeedsAuth(true);
        setError(data.error || 'Authentication required');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      setCampaigns(data.campaigns || []);
      setTotal(data.total || 0);
      setNeedsAuth(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCampaigns(searchQuery);
  };

  const connectToMautic = async () => {
    try {
      const response = await fetch('/api/mautic/auth');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setError('Failed to initiate OAuth flow');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (statusFilter === 'active') return campaign.isPublished;
    if (statusFilter === 'inactive') return !campaign.isPublished;
    return true;
  });

  const activeCampaigns = campaigns.filter((c) => c.isPublished).length;
  const inactiveCampaigns = campaigns.filter((c) => !c.isPublished).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Campaigns</h1>
            <p className="text-text-secondary mt-1">Automate your marketing workflows</p>
          </div>
          <a
            href={`${mauticUrl}/s/campaigns/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Campaign
          </a>
        </div>

        {/* Auth Required Banner */}
        {needsAuth && (
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary">Connect to Mautic</h3>
                <p className="text-text-secondary">You need to authorize this dashboard to access your Mautic instance.</p>
              </div>
              <button onClick={connectToMautic} className="btn-primary">
                Connect to Mautic
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && !needsAuth && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 mb-6">
            <p className="text-accent-red">{error}</p>
            <button onClick={() => fetchCampaigns(searchQuery)} className="text-accent-cyan underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Stats Row */}
        {!loading && !needsAuth && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Total Campaigns</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">{total}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Active Campaigns</p>
              <p className="text-2xl font-semibold text-accent-green mt-1">{activeCampaigns}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Inactive Campaigns</p>
              <p className="text-2xl font-semibold text-text-secondary mt-1">{inactiveCampaigns}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Quick Actions</p>
              <a
                href={`${mauticUrl}/s/campaigns`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan text-sm hover:underline mt-1 inline-block"
              >
                Open in Mautic →
              </a>
            </div>
          </div>
        )}

        {/* Filters */}
        <form onSubmit={handleSearch} className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="bg-bg-secondary border border-border-subtle rounded-lg px-4 py-2 text-text-secondary focus:outline-none focus:border-accent-cyan"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading campaigns...</p>
          </div>
        )}

        {/* Campaign Cards */}
        {!loading && filteredCampaigns.length > 0 && (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-cyan/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-text-primary">{campaign.name}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          campaign.isPublished
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'bg-text-muted/20 text-text-muted'
                        }`}
                      >
                        {campaign.isPublished ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-text-secondary mt-1">{campaign.description || 'No description'}</p>

                    {/* Campaign Stats */}
                    <div className="flex items-center gap-6 mt-4">
                      <div>
                        <p className="text-xs text-text-muted">Created</p>
                        <p className="text-sm font-medium text-text-primary">{formatDate(campaign.dateAdded)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Last Modified</p>
                        <p className="text-sm font-medium text-text-primary">{formatDate(campaign.dateModified)}</p>
                      </div>
                      {campaign.leads?.count !== undefined && (
                        <div>
                          <p className="text-xs text-text-muted">Contacts</p>
                          <p className="text-sm font-medium text-accent-cyan">{campaign.leads.count}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`${mauticUrl}/s/campaigns/edit/${campaign.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-cyan"
                      title="Edit in Mautic"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </a>
                    <a
                      href={`${mauticUrl}/s/campaigns/view/${campaign.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-purple"
                      title="View in Mautic"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredCampaigns.length === 0 && !error && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No campaigns found</h3>
            <p className="text-text-secondary mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Get started by creating your first automation campaign.'}
            </p>
            <a
              href={`${mauticUrl}/s/campaigns/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              Create Your First Campaign
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
