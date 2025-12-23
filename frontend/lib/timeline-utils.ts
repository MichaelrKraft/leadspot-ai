/**
 * Timeline Utility Functions for D3.js Visualization
 */

import { EventType, TimelineEvent, TimelineNode, TimelineLayout } from '@/types/timeline';
import * as d3 from 'd3';

/**
 * Color scales for different event types
 */
export const eventTypeColors: Record<EventType, string> = {
  document: '#3B82F6',
  slack: '#8B5CF6',
  email: '#10B981',
  decision: '#F59E0B',
};

/**
 * Get color for event type
 */
export function getEventColor(type: EventType): string {
  return eventTypeColors[type];
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date, format: 'short' | 'long' = 'short'): string {
  if (format === 'short') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

/**
 * Create time scale for timeline
 */
export function createTimeScale(
  events: TimelineEvent[],
  width: number,
  margin: { left: number; right: number }
): d3.ScaleTime<number, number> {
  const dates = events.map(e => e.timestamp);
  const extent = d3.extent(dates) as [Date, Date];

  return d3.scaleTime()
    .domain(extent)
    .range([margin.left, width - margin.right]);
}

/**
 * Calculate node positions for timeline layout
 */
export function calculateNodePositions(
  events: TimelineEvent[],
  layout: TimelineLayout
): TimelineNode[] {
  const timeScale = createTimeScale(events, layout.width, {
    left: layout.margin.left,
    right: layout.margin.right,
  });

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) =>
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Calculate positions with staggered y-levels to avoid overlap
  const nodes: TimelineNode[] = [];
  const usedPositions = new Map<string, { x: number; y: number }>();

  sortedEvents.forEach((event, index) => {
    const x = timeScale(event.timestamp);

    // Determine y position to avoid overlaps
    let y = layout.margin.top + layout.levelHeight;
    let level = 0;

    // Check for overlapping nodes
    const overlapThreshold = 50; // pixels
    let hasOverlap = true;

    while (hasOverlap && level < 5) {
      hasOverlap = false;
      for (const pos of Array.from(usedPositions.values())) {
        if (Math.abs(pos.x - x) < overlapThreshold && Math.abs(pos.y - y) < layout.levelHeight) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) {
        level++;
        y = layout.margin.top + layout.levelHeight * (level + 1);
      }
    }

    usedPositions.set(event.id, { x, y });

    nodes.push({
      id: event.id,
      event,
      x,
      y,
      connections: event.relatedEvents || [],
    });
  });

  return nodes;
}

/**
 * Get icon for event type
 */
export function getEventIcon(type: EventType): string {
  const icons: Record<EventType, string> = {
    document: '📄',
    slack: '💬',
    email: '📧',
    decision: '⚡',
  };
  return icons[type];
}

/**
 * Get event type label
 */
export function getEventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    document: 'Document',
    slack: 'Slack Message',
    email: 'Email',
    decision: 'Decision Point',
  };
  return labels[type];
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate factor percentages
 */
export function calculateFactorPercentages(factors: { weight: number }[]): number[] {
  const total = factors.reduce((sum, f) => sum + f.weight, 0);
  return factors.map(f => (f.weight / total) * 100);
}

/**
 * Generate D3 arc for pie chart
 */
export function createArcGenerator(innerRadius: number, outerRadius: number) {
  return d3.arc<d3.PieArcDatum<any>>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .padAngle(0.02);
}

/**
 * Filter events by criteria
 */
export function filterEvents(
  events: TimelineEvent[],
  filter: {
    types?: EventType[];
    dateRange?: { start: Date; end: Date };
    searchQuery?: string;
  }
): TimelineEvent[] {
  return events.filter(event => {
    // Filter by type
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(event.type)) return false;
    }

    // Filter by date range
    if (filter.dateRange) {
      if (event.timestamp < filter.dateRange.start || event.timestamp > filter.dateRange.end) {
        return false;
      }
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const searchableText = `${event.title} ${event.content} ${event.author}`.toLowerCase();
      if (!searchableText.includes(query)) return false;
    }

    return true;
  });
}
