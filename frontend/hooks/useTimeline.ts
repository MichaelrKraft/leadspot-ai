/**
 * Timeline Data Hook
 */

import { useState, useEffect } from 'react';
import { TimelineData, TimelineEvent, DecisionData } from '@/types/timeline';

interface UseTimelineResult {
  data: TimelineData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch and manage timeline data
 */
export function useTimeline(decisionId: string): UseTimelineResult {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/decisions/${decisionId}/timeline`);

      if (!response.ok) {
        throw new Error('Failed to fetch timeline data');
      }

      const timelineData: TimelineData = await response.json();
      setData(timelineData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (decisionId) {
      fetchTimeline();
    }
  }, [decisionId]);

  return {
    data,
    loading,
    error,
    refetch: fetchTimeline,
  };
}

/**
 * Generate mock timeline data for development
 */
export function generateMockTimelineData(decisionId: string): TimelineData {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const events: TimelineEvent[] = [
    {
      id: 'evt-1',
      type: 'document',
      title: 'Q4 Market Analysis Report',
      timestamp: daysAgo(45),
      author: 'Sarah Chen',
      content: 'Comprehensive market analysis showing 34% growth in enterprise segment with strong demand for knowledge synthesis tools. Key insight: Decision-makers spend 23 hours/week searching for information across fragmented systems.',
      sourceUrl: '/documents/market-analysis-q4',
      metadata: { tags: ['market-research', 'growth'] },
      relatedEvents: ['evt-2'],
    },
    {
      id: 'evt-2',
      type: 'slack',
      title: 'Product Strategy Discussion',
      timestamp: daysAgo(40),
      author: 'Mike Rodriguez',
      content: 'Team consensus: The "Decision Archaeology" feature could be our killer differentiator. No competitor offers retroactive timeline reconstruction of decision-making processes.',
      metadata: { channel: '#product-strategy' },
      relatedEvents: ['evt-1', 'evt-3'],
    },
    {
      id: 'evt-3',
      type: 'email',
      title: 'Customer Interview - TechCorp',
      timestamp: daysAgo(35),
      author: 'Jennifer Liu',
      content: 'CTO expressed frustration: "We make million-dollar decisions but can\'t trace back why we made them 6 months later. The institutional knowledge just evaporates." This validates our Decision Archaeology concept.',
      metadata: { recipients: ['product@innosynth.ai'] },
      relatedEvents: ['evt-2', 'evt-4'],
    },
    {
      id: 'evt-4',
      type: 'document',
      title: 'Competitive Analysis - Knowledge Management',
      timestamp: daysAgo(30),
      author: 'David Park',
      content: 'Analysis of 12 competitors: Notion, Confluence, Guru, etc. None offer timeline-based decision reconstruction. This represents a clear market gap and potential moat.',
      sourceUrl: '/documents/competitive-analysis',
      metadata: { tags: ['competitive-intel'] },
      relatedEvents: ['evt-3', 'evt-5'],
    },
    {
      id: 'evt-5',
      type: 'slack',
      title: 'Technical Feasibility Discussion',
      timestamp: daysAgo(25),
      author: 'Alex Kumar',
      content: 'Engineering assessment: D3.js timeline visualization is feasible. Can integrate with existing event stream. Estimated 3 sprint development cycle.',
      metadata: { channel: '#engineering' },
      relatedEvents: ['evt-4', 'evt-6'],
    },
    {
      id: 'evt-6',
      type: 'email',
      title: 'Investor Feedback - Sequoia',
      timestamp: daysAgo(20),
      author: 'Rachel Kim',
      content: 'Partner feedback: "Decision Archaeology is compelling. It\'s not just a feature, it\'s a paradigm shift in how enterprises think about knowledge management. This could command premium pricing."',
      metadata: { recipients: ['founders@innosynth.ai'] },
      relatedEvents: ['evt-5', 'evt-7'],
    },
    {
      id: 'evt-7',
      type: 'document',
      title: 'Financial Projections - Decision Archaeology Feature',
      timestamp: daysAgo(15),
      author: 'Tom Anderson',
      content: 'Revenue model analysis: Decision Archaeology as premium tier feature could drive 40% higher ARPU. Estimated 60% of enterprise customers would upgrade for this capability.',
      sourceUrl: '/documents/financial-projections',
      metadata: { tags: ['finance', 'projections'] },
      relatedEvents: ['evt-6', 'evt-8'],
    },
    {
      id: 'evt-8',
      type: 'slack',
      title: 'Go/No-Go Discussion',
      timestamp: daysAgo(10),
      author: 'Sarah Chen',
      content: 'All signals are green: Market validation ✓, Technical feasibility ✓, Investor enthusiasm ✓, Revenue potential ✓. Proposing we prioritize Decision Archaeology for Q1 roadmap.',
      metadata: { channel: '#leadership' },
      relatedEvents: ['evt-7', 'evt-9'],
    },
    {
      id: 'evt-9',
      type: 'decision',
      title: 'Final Decision: Build Decision Archaeology Feature',
      timestamp: daysAgo(5),
      author: 'Leadership Team',
      content: 'DECISION APPROVED: Prioritize Decision Archaeology timeline visualization as flagship feature for InnoSynth.ai platform. Target Q1 2025 launch. Allocate 2 engineers, 1 designer. This represents our key differentiation strategy.',
      relatedEvents: ['evt-8'],
    },
  ];

  const decision: DecisionData = {
    id: decisionId,
    title: 'Build Decision Archaeology Feature',
    description: 'Strategic decision to develop timeline-based decision reconstruction as core platform feature',
    timestamp: daysAgo(5),
    decision: 'Approved: Prioritize Decision Archaeology for Q1 2025 launch with dedicated team allocation',
    factors: [
      {
        id: 'factor-1',
        name: 'Market Demand',
        weight: 35,
        description: 'Strong validation from customer interviews and market research',
        supportingEvents: ['evt-1', 'evt-3'],
      },
      {
        id: 'factor-2',
        name: 'Competitive Advantage',
        weight: 30,
        description: 'Clear market gap with no direct competitors offering similar capability',
        supportingEvents: ['evt-4'],
      },
      {
        id: 'factor-3',
        name: 'Technical Feasibility',
        weight: 20,
        description: 'Engineering confidence in 3-sprint delivery timeline',
        supportingEvents: ['evt-5'],
      },
      {
        id: 'factor-4',
        name: 'Revenue Potential',
        weight: 15,
        description: 'Projected 40% ARPU increase with 60% enterprise adoption',
        supportingEvents: ['evt-7'],
      },
    ],
    outcome: 'Feature successfully prioritized for Q1 2025 roadmap',
    participants: ['Sarah Chen', 'Mike Rodriguez', 'Alex Kumar', 'Rachel Kim', 'Tom Anderson'],
  };

  const timeRange = {
    start: daysAgo(50),
    end: now,
  };

  return { events, decision, timeRange };
}
