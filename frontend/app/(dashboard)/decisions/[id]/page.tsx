/**
 * Decision Detail Page - Full timeline visualization with real API integration
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Users,
  Target,
  CheckCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import api from '@/lib/api';
import {
  Decision,
  TimelineResponse,
  FactorAnalysisResponse,
  RelatedDecisionsResponse,
  OutcomePrediction,
  AIInsightsResponse,
} from '@/types/decision';
import { DecisionTimeline } from '@/components/timeline/DecisionTimeline';
import { DecisionFactors } from '@/components/timeline/DecisionFactors';

// Demo decisions for bond trading / financial services (same as list page)
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

// Demo timeline events for each decision
const DEMO_TIMELINES: Record<string, TimelineResponse> = {
  'demo-1': {
    decision_id: 'demo-1',
    events: [
      { date: '2024-08-15', title: 'Market analysis completed', type: 'research', is_main: false, relationship: 'Identified $180B mid-market opportunity' },
      { date: '2024-09-01', title: 'Competitive landscape review', type: 'analysis', is_main: false, relationship: 'Confirmed gap in mid-market coverage' },
      { date: '2024-09-20', title: 'Board approval received', type: 'milestone', is_main: true, relationship: 'Strategic expansion approved with $5M budget' },
      { date: '2024-10-05', title: 'Hired 3 new traders', type: 'action', is_main: false, relationship: 'Expanded municipal desk capacity' },
      { date: '2024-11-15', title: 'First mid-market client onboarded', type: 'milestone', is_main: false, relationship: '$75M AUM regional pension fund' },
      { date: '2024-12-01', title: 'Q4 results exceed targets', type: 'outcome', is_main: true, relationship: '23 accounts, 34% revenue increase' },
    ],
  },
  'demo-2': {
    decision_id: 'demo-2',
    events: [
      { date: '2024-10-01', title: 'Client feedback collected', type: 'research', is_main: false, relationship: 'Top 10 clients cite pricing concerns' },
      { date: '2024-10-15', title: 'Vendor evaluation started', type: 'analysis', is_main: false, relationship: 'Reviewing 5 analytics platforms' },
      { date: '2024-11-01', title: 'Project approved', type: 'milestone', is_main: true, relationship: '$2.4M budget allocated for platform' },
      { date: '2024-11-20', title: 'Selected vendor: Bloomberg AIM', type: 'action', is_main: false, relationship: 'Best-in-class TRACE integration' },
      { date: '2024-12-10', title: 'Phase 1 implementation begins', type: 'action', is_main: false, relationship: 'Corporate bond pricing module in development' },
    ],
  },
  'demo-3': {
    decision_id: 'demo-3',
    events: [
      { date: '2024-11-01', title: 'ESG market research completed', type: 'research', is_main: false, relationship: 'Identified 42% YoY growth in ESG fixed income' },
      { date: '2024-11-15', title: 'Client interest survey', type: 'analysis', is_main: false, relationship: '7 clients expressed strong interest' },
      { date: '2024-12-01', title: 'Initiative approved', type: 'milestone', is_main: true, relationship: 'Board green-lights ESG practice' },
      { date: '2024-12-15', title: 'First ESG analyst hired', type: 'action', is_main: false, relationship: 'Former MSCI ESG researcher joins team' },
    ],
  },
  'demo-4': {
    decision_id: 'demo-4',
    events: [
      { date: '2024-07-15', title: 'FINRA examination findings', type: 'trigger', is_main: true, relationship: 'Compliance system flagged for deficiencies' },
      { date: '2024-08-01', title: 'Remediation plan submitted', type: 'action', is_main: false, relationship: '90-day deadline for improvements' },
      { date: '2024-09-01', title: 'Vendor selection process', type: 'analysis', is_main: false, relationship: 'Evaluating AI-powered surveillance tools' },
      { date: '2024-10-01', title: 'Implementation kickoff', type: 'milestone', is_main: false, relationship: 'Selected NICE Actimize platform' },
      { date: '2024-11-15', title: 'Phase 1 go-live', type: 'milestone', is_main: true, relationship: 'Trade surveillance module active' },
    ],
  },
  'demo-5': {
    decision_id: 'demo-5',
    events: [
      { date: '2024-06-30', title: 'Q2 loss event', type: 'trigger', is_main: true, relationship: '$3.2M single-issuer loss' },
      { date: '2024-07-10', title: 'Risk committee review', type: 'analysis', is_main: false, relationship: 'Emergency meeting called' },
      { date: '2024-07-15', title: 'New limits approved', type: 'milestone', is_main: true, relationship: 'Concentration limits reduced to 3%' },
      { date: '2024-08-01', title: 'VaR model updated', type: 'action', is_main: false, relationship: 'Dynamic limits implemented' },
      { date: '2024-09-30', title: 'Q3 results validated', type: 'outcome', is_main: false, relationship: 'VaR reduced 28%, no major losses' },
    ],
  },
};

// Loading skeleton for the header
function HeaderSkeleton() {
  return (
    <div className="mb-8 animate-pulse rounded-lg border border-gray-700 bg-gray-800 p-8">
      <div className="mb-4 h-10 w-3/4 rounded bg-gray-700"></div>
      <div className="mb-6 h-6 w-full rounded bg-gray-700"></div>
      <div className="grid grid-cols-3 gap-6">
        <div className="h-16 rounded bg-gray-700"></div>
        <div className="h-16 rounded bg-gray-700"></div>
        <div className="h-16 rounded bg-gray-700"></div>
      </div>
    </div>
  );
}

// Loading skeleton for timeline
function TimelineSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="mt-2 h-4 w-4 rounded-full bg-gray-700"></div>
          <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="mb-2 h-5 w-1/2 rounded bg-gray-700"></div>
            <div className="mb-1 h-4 w-full rounded bg-gray-700"></div>
            <div className="h-4 w-3/4 rounded bg-gray-700"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DecisionDetailPage() {
  const params = useParams();
  const decisionId = params.id as string;

  // State
  const [decision, setDecision] = useState<Decision | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [factors, setFactors] = useState<FactorAnalysisResponse | null>(null);
  const [related, setRelated] = useState<RelatedDecisionsResponse | null>(null);
  const [predictions, setPredictions] = useState<OutcomePrediction | null>(null);
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [factorsLoading, setFactorsLoading] = useState(true);
  const [predictingOutcomes, setPredictingOutcomes] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [showRelated, setShowRelated] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);

  // Check if this is a demo decision
  const isDemo = decisionId?.startsWith('demo-');

  // Fetch decision details
  const fetchDecision = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Handle demo decisions locally
      if (isDemo) {
        const demoDecision = DEMO_DECISIONS.find(d => d.id === decisionId);
        if (demoDecision) {
          setDecision(demoDecision);
        } else {
          setError('Demo decision not found.');
        }
        return;
      }

      const response = await api.decisions.get(decisionId);
      setDecision(response.data as Decision);
    } catch (err) {
      console.error('Error fetching decision:', err);
      setError('Failed to load decision. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [decisionId, isDemo]);

  // Fetch timeline
  const fetchTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);

      // Handle demo timelines locally
      if (isDemo && DEMO_TIMELINES[decisionId]) {
        setTimeline(DEMO_TIMELINES[decisionId]);
        return;
      }

      const response = await api.decisions.getTimeline(decisionId);
      setTimeline(response.data as TimelineResponse);
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [decisionId, isDemo]);

  // Fetch factors
  const fetchFactors = useCallback(async () => {
    try {
      setFactorsLoading(true);

      // For demo decisions, factors are already included in the decision data
      if (isDemo) {
        setFactorsLoading(false);
        return;
      }

      const response = await api.decisions.getFactors(decisionId);
      setFactors(response.data as FactorAnalysisResponse);
    } catch (err) {
      console.error('Error fetching factors:', err);
    } finally {
      setFactorsLoading(false);
    }
  }, [decisionId, isDemo]);

  // Fetch related decisions
  const fetchRelated = useCallback(async () => {
    // Skip for demo decisions - no related demo data
    if (isDemo) {
      setRelated({ related: [] });
      return;
    }

    try {
      const response = await api.decisions.getRelated(decisionId);
      setRelated(response.data as RelatedDecisionsResponse);
    } catch (err) {
      console.error('Error fetching related decisions:', err);
    }
  }, [decisionId, isDemo]);

  // Predict outcomes
  const handlePredictOutcomes = async () => {
    try {
      setPredictingOutcomes(true);
      const response = await api.decisions.predictOutcomes(decisionId);
      setPredictions(response.data as OutcomePrediction);
      setShowPredictions(true);
    } catch (err) {
      console.error('Error predicting outcomes:', err);
    } finally {
      setPredictingOutcomes(false);
    }
  };

  // Generate AI insights
  const handleGenerateInsights = async () => {
    try {
      setGeneratingInsights(true);
      const response = await api.decisions.getInsights(decisionId);
      setInsights(response.data as AIInsightsResponse);
    } catch (err) {
      console.error('Error generating insights:', err);
    } finally {
      setGeneratingInsights(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (decisionId) {
      fetchDecision();
      fetchTimeline();
      fetchFactors();
      fetchRelated();
    }
  }, [decisionId, fetchDecision, fetchTimeline, fetchFactors, fetchRelated]);

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
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

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-6 py-8 text-white">
        <Link
          href="/decisions"
          className="mb-6 inline-flex items-center gap-2 text-gray-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Decisions</span>
        </Link>

        <div className="rounded-lg border border-red-500/50 bg-red-500/20 p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-xl font-semibold text-white">Error Loading Decision</h2>
          <p className="mb-4 text-red-400">{error}</p>
          <button
            onClick={fetchDecision}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-red-400 hover:bg-red-500/30"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8 text-white">
        <Link
          href="/decisions"
          className="mb-6 inline-flex items-center gap-2 text-gray-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Decisions</span>
        </Link>
        <HeaderSkeleton />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="h-80 animate-pulse rounded-lg border border-gray-700 bg-gray-800 p-6"></div>
          </div>
          <div className="lg:col-span-2">
            <TimelineSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="container mx-auto px-6 py-8 text-white">
        <Link
          href="/decisions"
          className="mb-6 inline-flex items-center gap-2 text-gray-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Decisions</span>
        </Link>
        <div className="py-12 text-center">
          <p className="text-gray-300">Decision not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Back Button */}
      <Link
        href="/decisions"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Decisions</span>
      </Link>

      {/* Decision Header Card */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {decision.category && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
              {decision.category}
            </span>
          )}
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getStatusColor(decision.status)}`}
          >
            {decision.status}
          </span>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{decision.title}</h1>
        <p className="mb-6 text-lg leading-relaxed text-gray-600 dark:text-gray-400">{decision.description}</p>

        {/* Meta Stats */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-6 dark:border-gray-700 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">Created</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(decision.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-500/10">
              <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">Category</p>
              <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{decision.category || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">Factors</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{decision.factors.length} analyzed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-500/10">
              <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">Outcomes</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{decision.outcomes.length} tracked</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Factors & Outcomes */}
        <div className="space-y-6 lg:col-span-1">
          {/* Decision Factors */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Decision Factors</h2>
            {factorsLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                ))}
              </div>
            ) : decision.factors.length > 0 ? (
              <div className="space-y-3">
                {decision.factors.map((factor) => (
                  <div
                    key={factor.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">{factor.name}</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                        {factor.impact_score}/10
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{factor.explanation}</p>
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${factor.impact_score * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-500">No factors analyzed yet</p>
            )}
          </div>

          {/* Outcomes */}
          {decision.outcomes.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Outcomes</h2>
              <div className="space-y-3">
                {decision.outcomes.map((outcome) => (
                  <div
                    key={outcome.id}
                    className={`rounded-lg border p-4 ${
                      outcome.status === 'realized'
                        ? 'border-green-200 bg-green-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                        : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {outcome.status === 'realized' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                      ) : (
                        <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      )}
                      <span
                        className={`text-xs font-semibold uppercase ${
                          outcome.status === 'realized' ? 'text-green-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {outcome.status === 'realized' ? 'Achieved' : 'Predicted'}
                      </span>
                      {outcome.likelihood && (
                        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{outcome.likelihood}% likely</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{outcome.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Decision Timeline</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Key events and milestones</p>
            </div>

            {timelineLoading ? (
              <TimelineSkeleton />
            ) : timeline && timeline.events.length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-0 h-full w-0.5 bg-gray-200 dark:bg-gray-700" />

                <div className="space-y-6">
                  {timeline.events.map((event, index) => (
                    <div key={index} className="relative flex gap-6">
                      {/* Timeline dot */}
                      <div
                        className={`relative z-10 mt-1.5 h-6 w-6 flex-shrink-0 rounded-full border-2 ${
                          event.is_main
                            ? 'border-blue-400 bg-blue-500'
                            : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'
                        }`}
                      >
                        {event.is_main && (
                          <div className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-25" />
                        )}
                      </div>

                      {/* Event card */}
                      <div
                        className={`flex-1 rounded-lg border p-5 transition-all ${
                          event.is_main
                            ? 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                              event.is_main
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {event.type}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{event.date}</span>
                        </div>
                        <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                        {event.relationship && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{event.relationship}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-700/50">
                <p className="text-gray-500 dark:text-gray-400">No timeline events available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Decisions */}
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <button
          onClick={() => setShowRelated(!showRelated)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Related Decisions</h2>
          {showRelated ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {showRelated && (
          <div className="mt-4">
            {related && related.related.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {related.related.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/decisions/${rel.id}`}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700"
                  >
                    <h3 className="mb-1 font-medium text-gray-900 dark:text-white">{rel.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{rel.date}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                No related decisions found.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
