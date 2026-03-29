'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTenantMauticUrl } from '@/hooks/useTenantConfig';

interface MauticEmail {
  id: number;
  name: string;
  subject: string;
  isPublished: boolean;
  readCount: number;
  sentCount: number;
  dateAdded: string;
  dateModified: string;
  emailType?: string;
  language?: string;
  variantSentCount?: number;
  variantReadCount?: number;
}

interface EmailsResponse {
  emails: MauticEmail[];
  total: number;
  error?: string;
}

export default function EmailsPage() {
  const { mauticUrl } = useTenantMauticUrl();
  const [emails, setEmails] = useState<MauticEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const fetchEmails = async (search?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '50');

      const response = await fetch(`/api/mautic/emails?${params.toString()}`);
      const data: EmailsResponse = await response.json();

      if (response.status === 401) {
        setNeedsAuth(true);
        setError(data.error || 'Authentication required');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch emails');
      }

      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setNeedsAuth(false);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmails(searchQuery);
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

  const calculateOpenRate = (sent: number, read: number) => {
    if (!sent || sent === 0) return '0';
    return ((read / sent) * 100).toFixed(1);
  };

  const filteredEmails = emails.filter((email) => {
    if (statusFilter === 'published') return email.isPublished;
    if (statusFilter === 'draft') return !email.isPublished;
    return true;
  });

  const totalSent = emails.reduce((acc, e) => acc + (e.sentCount || 0), 0);
  const totalRead = emails.reduce((acc, e) => acc + (e.readCount || 0), 0);
  const avgOpenRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : '0';
  const publishedCount = emails.filter((e) => e.isPublished).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Emails</h1>
            <p className="text-text-secondary mt-1">Create and manage your email templates</p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${mauticUrl}/s/emails`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Mautic
            </a>
            <a
              href={`${mauticUrl}/s/emails/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Email
            </a>
          </div>
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
            <button onClick={() => fetchEmails(searchQuery)} className="text-accent-cyan underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Stats Row */}
        {!loading && !needsAuth && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Total Emails</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">{total}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Total Sent</p>
              <p className="text-2xl font-semibold text-accent-cyan mt-1">{totalSent.toLocaleString()}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Avg. Open Rate</p>
              <p className="text-2xl font-semibold text-accent-purple mt-1">{avgOpenRate}%</p>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
              <p className="text-text-muted text-sm">Published</p>
              <p className="text-2xl font-semibold text-accent-green mt-1">{publishedCount}</p>
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
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
            className="bg-bg-secondary border border-border-subtle rounded-lg px-4 py-2 text-text-secondary focus:outline-none focus:border-accent-cyan"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading emails...</p>
          </div>
        )}

        {/* Email Grid */}
        {!loading && filteredEmails.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-cyan/50 transition-colors"
              >
                {/* Email Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          email.emailType === 'template'
                            ? 'bg-accent-purple/20 text-accent-purple'
                            : 'bg-accent-yellow/20 text-accent-yellow'
                        }`}
                      >
                        {email.emailType || 'email'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          email.isPublished
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'bg-text-muted/20 text-text-muted'
                        }`}
                      >
                        {email.isPublished ? 'published' : 'draft'}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{email.name}</h3>
                    <p className="text-text-secondary text-sm mt-1">{email.subject || 'No subject'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`${mauticUrl}/s/emails/edit/${email.id}`}
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
                      href={`${mauticUrl}/s/emails/view/${email.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-purple"
                      title="View in Mautic"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Email Stats */}
                {email.sentCount > 0 ? (
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border-subtle">
                    <div>
                      <p className="text-xs text-text-muted">Sent</p>
                      <p className="text-sm font-medium text-text-primary">{email.sentCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Opened</p>
                      <p className="text-sm font-medium text-accent-cyan">
                        {email.readCount.toLocaleString()}
                        <span className="text-text-muted ml-1">({calculateOpenRate(email.sentCount, email.readCount)}%)</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Open Rate</p>
                      <p className="text-sm font-medium text-accent-purple">
                        {calculateOpenRate(email.sentCount, email.readCount)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-border-subtle">
                    <p className="text-sm text-text-muted">No sends yet</p>
                  </div>
                )}

                {/* Last Modified */}
                <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between">
                  <p className="text-xs text-text-muted">Last modified: {formatDate(email.dateModified)}</p>
                  {!email.isPublished && (
                    <a
                      href={`${mauticUrl}/s/emails/edit/${email.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                    >
                      Continue editing →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredEmails.length === 0 && !error && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No emails found</h3>
            <p className="text-text-secondary mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Get started by creating your first email template.'}
            </p>
            <a
              href={`${mauticUrl}/s/emails/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              Create Your First Email
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
