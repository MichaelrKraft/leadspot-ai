'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTenantMauticUrl } from '@/hooks/useTenantConfig';

interface MauticSegment {
  id: number;
  name: string;
  alias: string;
  description: string;
  isPublished: boolean;
  isGlobal: boolean;
  dateAdded: string;
  dateModified: string;
  leadCount?: number;
}

interface SegmentsResponse {
  segments: MauticSegment[];
  total: number;
  error?: string;
}

export default function SegmentsPage() {
  const { mauticUrl } = useTenantMauticUrl();
  const [segments, setSegments] = useState<MauticSegment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSegments = async (search?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '50');

      const response = await fetch(`/api/mautic/segments?${params.toString()}`);
      const data: SegmentsResponse = await response.json();

      if (response.status === 401) {
        setNeedsAuth(true);
        setError(data.error || 'Authentication required');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch segments');
      }

      setSegments(data.segments || []);
      setTotal(data.total || 0);
      setNeedsAuth(false);
    } catch {
      setError( 'Failed to fetch segments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSegments(searchQuery);
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

  // Utility function for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const totalContacts = segments.reduce((acc, s) => acc + (s.leadCount || 0), 0);
  const publishedSegments = segments.filter((s) => s.isPublished).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Segments</h1>
            <p className="text-text-secondary mt-1">Organize contacts into targeted groups</p>
          </div>
          <a
            href={`${mauticUrl}/s/segments/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Segment
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
            <button onClick={() => fetchSegments(searchQuery)} className="text-accent-cyan underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Stats Row */}
        {!loading && !needsAuth && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Total Segments</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">{total}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Published</p>
              <p className="text-2xl font-semibold text-accent-green mt-1">{publishedSegments}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Total Contacts in Segments</p>
              <p className="text-2xl font-semibold text-accent-cyan mt-1">{totalContacts.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search segments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading segments...</p>
          </div>
        )}

        {/* Segments Grid */}
        {!loading && segments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="bg-bg-secondary rounded-xl border border-border-subtle p-5 hover:border-accent-cyan/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary">{segment.name}</h3>
                    <p className="text-text-muted text-sm">{segment.alias}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      segment.isPublished
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-text-muted/20 text-text-muted'
                    }`}
                  >
                    {segment.isPublished ? 'Active' : 'Draft'}
                  </span>
                </div>

                <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                  {segment.description || 'No description'}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                  <div>
                    <p className="text-2xl font-semibold text-accent-cyan">{(segment.leadCount || 0).toLocaleString()}</p>
                    <p className="text-xs text-text-muted">Contacts</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`${mauticUrl}/s/segments/edit/${segment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-cyan"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </a>
                    <a
                      href={`${mauticUrl}/s/segments/view/${segment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-purple"
                      title="View"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        {!loading && segments.length === 0 && !error && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No segments found</h3>
            <p className="text-text-secondary mb-6">Create segments to organize your contacts into targeted groups.</p>
            <a
              href={`${mauticUrl}/s/segments/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              Create Your First Segment
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
