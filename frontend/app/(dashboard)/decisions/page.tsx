/**
 * Decisions Page - List and search decisions with real API integration
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Calendar,
  Users,
  TrendingUp,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { Decision, DecisionList, GraphStats } from '@/types/decision';

// Loading skeleton component
function DecisionSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-3 h-6 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="mb-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="mb-4 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="flex gap-4">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
        <div className="h-6 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
    </div>
  );
}

// Stats card skeleton
function StatsSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
      <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>
  );
}

// Demo decisions tailored for bond trading / financial services
// Defined outside component to avoid recreation on every render
const DEMO_DECISIONS: Decision[] = [
    {
      id: 'demo-1',
      user_id: 'demo',
      title: 'Expand municipal bond offerings to mid-market clients',
      description: 'Strategic decision to expand our municipal bond product suite to serve mid-market institutional clients ($50M-$500M AUM). This segment is underserved by larger dealers and offers attractive margins. Requires enhancing our trading desk capacity and building relationships with regional broker-dealers.',
      category: 'strategic',
      status: 'implemented',
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      factors: [
        { id: 'f1', decision_id: 'demo-1', name: 'Market opportunity', category: 'market', impact_score: 9, explanation: '$180B addressable market in mid-market muni bonds' },
        { id: 'f2', decision_id: 'demo-1', name: 'Competitive gap', category: 'competitive', impact_score: 8, explanation: 'Large dealers focused on $1B+ accounts, leaving mid-market underserved' },
        { id: 'f3', decision_id: 'demo-1', name: 'Margin improvement', category: 'financial', impact_score: 7, explanation: 'Mid-market trades carry 15-20bps higher spreads' },
      ],
      outcomes: [
        { id: 'o1', decision_id: 'demo-1', description: 'Added 23 new mid-market accounts in Q3', outcome_type: 'actual', status: 'realized' },
        { id: 'o2', decision_id: 'demo-1', description: 'Increased municipal bond revenue by 34%', outcome_type: 'actual', status: 'realized' },
      ],
    },
    {
      id: 'demo-2',
      user_id: 'demo',
      title: 'Implement real-time bond pricing analytics platform',
      description: 'Investing $2.4M in a new real-time pricing and analytics platform to improve quote accuracy and reduce latency. The platform will integrate TRACE data, Bloomberg feeds, and proprietary pricing models to give traders competitive advantage in illiquid markets.',
      category: 'technical',
      status: 'active',
      created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      factors: [
        { id: 'f4', decision_id: 'demo-2', name: 'Pricing accuracy', category: 'operational', impact_score: 9, explanation: 'Current system has 8bps average pricing error on corporate bonds' },
        { id: 'f5', decision_id: 'demo-2', name: 'Client demands', category: 'market', impact_score: 8, explanation: 'Three top-10 clients requested better pricing transparency' },
        { id: 'f6', decision_id: 'demo-2', name: 'Regulatory pressure', category: 'regulatory', impact_score: 7, explanation: 'SEC focus on best execution requires demonstrable pricing methodology' },
      ],
      outcomes: [
        { id: 'o3', decision_id: 'demo-2', description: 'Reduce pricing latency from 2.5 seconds to under 200ms', outcome_type: 'predicted', likelihood: 90, status: 'predicted' },
      ],
    },
    {
      id: 'demo-3',
      user_id: 'demo',
      title: 'Launch ESG bond advisory practice',
      description: 'Establishing a dedicated ESG fixed income advisory team to capitalize on growing demand for sustainable bond investments. Will offer green bond sourcing, ESG screening, and impact reporting for institutional clients. Hiring 4 ESG analysts and partnering with third-party rating providers.',
      category: 'strategic',
      status: 'active',
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      factors: [
        { id: 'f7', decision_id: 'demo-3', name: 'ESG mandate growth', category: 'market', impact_score: 9, explanation: 'ESG fixed income AUM grew 42% YoY to $4.1T globally' },
        { id: 'f8', decision_id: 'demo-3', name: 'Client pipeline', category: 'financial', impact_score: 8, explanation: '7 existing clients expressed interest in ESG bond solutions' },
        { id: 'f9', decision_id: 'demo-3', name: 'First-mover advantage', category: 'competitive', impact_score: 7, explanation: 'Few regional dealers have dedicated ESG fixed income capabilities' },
      ],
      outcomes: [],
    },
    {
      id: 'demo-4',
      user_id: 'demo',
      title: 'Upgrade FINRA compliance monitoring system',
      description: 'Replacing legacy compliance system with modern surveillance platform to meet FINRA Rule 3110 requirements. New system includes AI-powered trade surveillance, automated exception reporting, and enhanced audit trail capabilities. Critical for upcoming FINRA exam.',
      category: 'operational',
      status: 'active',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      factors: [
        { id: 'f10', decision_id: 'demo-4', name: 'Regulatory risk', category: 'regulatory', impact_score: 10, explanation: 'Current system flagged in last FINRA examination' },
        { id: 'f11', decision_id: 'demo-4', name: 'Operational efficiency', category: 'operational', impact_score: 7, explanation: 'Compliance team spending 60% of time on manual reviews' },
        { id: 'f12', decision_id: 'demo-4', name: 'Audit readiness', category: 'regulatory', impact_score: 8, explanation: 'Improved documentation for SEC and FINRA audits' },
      ],
      outcomes: [
        { id: 'o4', decision_id: 'demo-4', description: 'Reduce compliance review time by 45%', outcome_type: 'predicted', likelihood: 85, status: 'predicted' },
        { id: 'o5', decision_id: 'demo-4', description: 'Pass upcoming FINRA examination with no material findings', outcome_type: 'predicted', likelihood: 80, status: 'predicted' },
      ],
    },
    {
      id: 'demo-5',
      user_id: 'demo',
      title: 'Restructure corporate bond inventory limits',
      description: 'Revising position limits and risk parameters for corporate bond trading desk following Q2 volatility. Reducing single-issuer concentration limits from 5% to 3% of inventory, implementing dynamic VaR-based limits, and adding sector exposure caps.',
      category: 'financial',
      status: 'implemented',
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      factors: [
        { id: 'f13', decision_id: 'demo-5', name: 'Q2 P&L volatility', category: 'financial', impact_score: 9, explanation: 'Single issuer loss of $3.2M exceeded monthly risk budget' },
        { id: 'f14', decision_id: 'demo-5', name: 'Risk committee directive', category: 'regulatory', impact_score: 8, explanation: 'Board risk committee requested enhanced controls' },
        { id: 'f15', decision_id: 'demo-5', name: 'Market conditions', category: 'market', impact_score: 7, explanation: 'Credit spreads widening, increased default risk in HY segment' },
      ],
      outcomes: [
        { id: 'o6', decision_id: 'demo-5', description: 'Reduced daily VaR by 28%', outcome_type: 'actual', status: 'realized' },
        { id: 'o7', decision_id: 'demo-5', description: 'No single-issuer losses exceeding $500K since implementation', outcome_type: 'actual', status: 'realized' },
      ],
    },
];

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showingDemo, setShowingDemo] = useState(false);

  const pageSize = 20;

  // Fetch decisions from API
  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }

      const response = await api.decisions.list(params);
      const data = response.data as DecisionList;

      // Show demo data when user has no real decisions (and no filters applied)
      if (data.decisions.length === 0 && statusFilter === 'all' && categoryFilter === 'all') {
        setDecisions(DEMO_DECISIONS);
        setTotalCount(DEMO_DECISIONS.length);
        setShowingDemo(true);
      } else {
        setDecisions(data.decisions);
        setTotalCount(data.total);
        setShowingDemo(false);
      }
    } catch (err) {
      console.error('Error fetching decisions:', err);
      // Show demo data on error (e.g., not logged in)
      setDecisions(DEMO_DECISIONS);
      setTotalCount(DEMO_DECISIONS.length);
      setShowingDemo(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter]);

  // Fetch graph stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await api.decisions.getGraphStats();
      setGraphStats(response.data as GraphStats);
    } catch (err) {
      console.error('Error fetching graph stats:', err);
      // Show demo stats on error
      setGraphStats({
        decisions: 5,
        people: 12,
        projects: 8,
        relationships: 24,
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Natural language search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchDecisions();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.decisions.query({
        query: searchQuery,
        max_results: pageSize,
      });

      const data = response.data as Decision[];
      setDecisions(data);
      setTotalCount(data.length);
      setShowingDemo(false);
    } catch (err) {
      console.error('Error searching decisions:', err);
      // Filter demo data locally when API fails
      const query = searchQuery.toLowerCase();
      const filtered = DEMO_DECISIONS.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.description.toLowerCase().includes(query) ||
          d.category?.toLowerCase().includes(query) ||
          d.factors.some((f) => f.name.toLowerCase().includes(query))
      );
      setDecisions(filtered);
      setTotalCount(filtered.length);
      setShowingDemo(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDecisions();
    fetchStats();
  }, [fetchDecisions, fetchStats]);

  // Handle Enter key for search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'active':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'archived':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'abandoned':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getCategoryColor = (category: string | undefined) => {
    switch (category) {
      case 'strategic':
        return 'bg-purple-500/20 text-purple-400';
      case 'technical':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'financial':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'operational':
        return 'bg-orange-500/20 text-orange-400';
      case 'tactical':
        return 'bg-pink-500/20 text-pink-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  };

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Decision Archaeology</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Explore the timeline of decisions and discover the events that shaped them
          </p>
        </div>
        <Link
          href="/decisions/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>New Decision</span>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Try: 'FINRA compliance' or 'municipal bond strategy'..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="strategic">Strategic</option>
          <option value="technical">Technical</option>
          <option value="financial">Financial</option>
          <option value="operational">Operational</option>
          <option value="tactical">Tactical</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="implemented">Implemented</option>
          <option value="archived">Archived</option>
          <option value="abandoned">Abandoned</option>
        </select>

        <button
          onClick={handleSearch}
          className="rounded-lg bg-blue-600 px-4 py-3 text-white transition-colors hover:bg-blue-700"
        >
          Search
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        {statsLoading ? (
          <>
            <StatsSkeleton />
            <StatsSkeleton />
            <StatsSkeleton />
            <StatsSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Decisions</span>
                <TrendingUp className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {graphStats?.decisions || totalCount}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">People</span>
                <Users className="h-5 w-5 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{graphStats?.people || 0}</div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Projects</span>
                <Calendar className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{graphStats?.projects || 0}</div>
            </div>

            <Link
              href="/decisions/graph"
              className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-colors hover:border-blue-500"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Graph Relationships</span>
                <TrendingUp className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{graphStats?.relationships || 0}</div>
              <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">View Graph →</div>
            </Link>
          </>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={fetchDecisions}
            className="ml-auto flex items-center gap-2 rounded bg-red-500/20 px-3 py-1 text-red-400 hover:bg-red-500/30"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Decisions List */}
      <div className="space-y-4">
        {loading ? (
          <>
            <DecisionSkeleton />
            <DecisionSkeleton />
            <DecisionSkeleton />
          </>
        ) : decisions.length > 0 ? (
          decisions.map((decision) => (
            <Link
              key={decision.id}
              href={`/decisions/${decision.id}`}
              className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-all hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{decision.title}</h3>
                    {decision.category && (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${getCategoryColor(decision.category)}`}
                      >
                        {decision.category}
                      </span>
                    )}
                  </div>
                  <p className="mb-4 line-clamp-2 text-gray-600 dark:text-gray-400">{decision.description}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(decision.created_at)}</span>
                    </div>

                    {decision.factors.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500">
                        <TrendingUp className="h-4 w-4" />
                        <span>{decision.factors.length} factors</span>
                      </div>
                    )}

                    {decision.outcomes.length > 0 && (
                      <div className="text-gray-500 dark:text-gray-500">{decision.outcomes.length} outcomes</div>
                    )}
                  </div>
                </div>

                <div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusColor(decision.status)}`}
                  >
                    {decision.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12 text-center">
            <div className="mb-4 text-gray-600 dark:text-gray-400">
              {searchQuery ? 'No decisions found matching your search' : 'No decisions yet'}
            </div>
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  fetchDecisions();
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/decisions/new"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                <span>Create your first decision</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalCount > pageSize && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-400">
            Page {page} of {Math.ceil(totalCount / pageSize)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(totalCount / pageSize)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
