'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTenantMauticUrl } from '@/hooks/useTenantConfig';

interface MauticStats {
  contacts: {
    total: number;
    identified: number;
    anonymous: number;
  };
  emails: {
    sent: number;
    read: number;
    clicked: number;
    bounced: number;
  };
  campaigns: {
    active: number;
    total: number;
  };
}

interface StatsResponse extends Partial<MauticStats> {
  error?: string;
}

export default function ReportsPage() {
  const { mauticUrl } = useTenantMauticUrl();
  const [stats, setStats] = useState<MauticStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mautic/stats');
      const data: StatsResponse = await response.json();

      if (response.status === 401) {
        setNeedsAuth(true);
        setError(data.error || 'Authentication required');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      // API returns stats directly, not wrapped
      if (data.contacts && data.emails && data.campaigns) {
        setStats({
          contacts: data.contacts,
          emails: data.emails,
          campaigns: data.campaigns,
        });
      } else {
        setStats(null);
      }
      setNeedsAuth(false);
    } catch {
      setError( 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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

  const calculateOpenRate = () => {
    if (!stats || stats.emails.sent === 0) return 0;
    return ((stats.emails.read / stats.emails.sent) * 100).toFixed(1);
  };

  const calculateClickRate = () => {
    if (!stats || stats.emails.read === 0) return 0;
    return ((stats.emails.clicked / stats.emails.read) * 100).toFixed(1);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Reports</h1>
            <p className="text-text-secondary mt-1">Analytics and performance insights</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
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
            <button onClick={fetchStats} className="text-accent-cyan underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading reports...</p>
          </div>
        )}

        {/* Stats Dashboard */}
        {!loading && stats && (
          <>
            {/* Contact Stats */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Contacts Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm">Total Contacts</p>
                      <p className="text-3xl font-semibold text-text-primary mt-2">{stats.contacts.total.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-accent-cyan/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm">Identified</p>
                      <p className="text-3xl font-semibold text-accent-green mt-2">{stats.contacts.identified.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm">Anonymous</p>
                      <p className="text-3xl font-semibold text-text-muted mt-2">{stats.contacts.anonymous.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center">
                      <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Stats */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Email Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <p className="text-text-muted text-sm">Emails Sent</p>
                  <p className="text-3xl font-semibold text-text-primary mt-2">{stats.emails.sent.toLocaleString()}</p>
                </div>

                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <p className="text-text-muted text-sm">Opened</p>
                  <p className="text-3xl font-semibold text-accent-green mt-2">{stats.emails.read.toLocaleString()}</p>
                  <p className="text-sm text-accent-green mt-1">{calculateOpenRate()}% open rate</p>
                </div>

                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <p className="text-text-muted text-sm">Clicked</p>
                  <p className="text-3xl font-semibold text-accent-cyan mt-2">{stats.emails.clicked.toLocaleString()}</p>
                  <p className="text-sm text-accent-cyan mt-1">{calculateClickRate()}% click rate</p>
                </div>

                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <p className="text-text-muted text-sm">Bounced</p>
                  <p className="text-3xl font-semibold text-accent-red mt-2">{stats.emails.bounced.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Campaign Stats */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Campaigns</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm">Active Campaigns</p>
                      <p className="text-3xl font-semibold text-accent-green mt-2">{stats.campaigns.active}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm">Total Campaigns</p>
                      <p className="text-3xl font-semibold text-text-primary mt-2">{stats.campaigns.total}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-accent-purple/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Detailed Reports</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a
                  href={`${mauticUrl}/s/reports`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bg-secondary rounded-xl border border-border-subtle p-5 hover:border-accent-cyan/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-text-primary font-medium group-hover:text-accent-cyan transition-colors">All Reports</span>
                  </div>
                </a>

                <a
                  href={`${mauticUrl}/s/emails`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bg-secondary rounded-xl border border-border-subtle p-5 hover:border-accent-purple/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-text-primary font-medium group-hover:text-accent-purple transition-colors">Email Stats</span>
                  </div>
                </a>

                <a
                  href={`${mauticUrl}/s/campaigns`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bg-secondary rounded-xl border border-border-subtle p-5 hover:border-accent-green/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-text-primary font-medium group-hover:text-accent-green transition-colors">Campaign Stats</span>
                  </div>
                </a>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && !stats && !error && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No data available</h3>
            <p className="text-text-secondary">Connect to Mautic to view your analytics.</p>
          </div>
        )}
      </main>
    </div>
  );
}
