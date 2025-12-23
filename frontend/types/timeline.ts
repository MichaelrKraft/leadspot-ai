/**
 * Timeline Type Definitions for InnoSynth.ai Decision Archaeology
 */

export type EventType = 'document' | 'slack' | 'email' | 'decision';

export interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  timestamp: Date;
  author: string;
  content: string;
  sourceUrl?: string;
  metadata?: {
    channel?: string;
    recipients?: string[];
    tags?: string[];
    [key: string]: any;
  };
  relatedEvents?: string[];
}

export interface TimelineNode {
  id: string;
  event: TimelineEvent;
  x: number;
  y: number;
  connections: string[];
}

export interface DecisionFactor {
  id: string;
  name: string;
  weight: number;
  description: string;
  supportingEvents: string[];
}

export interface DecisionData {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  decision: string;
  factors: DecisionFactor[];
  outcome?: string;
  participants: string[];
}

export interface TimelineData {
  events: TimelineEvent[];
  decision: DecisionData;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface TimelineFilter {
  eventTypes: EventType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export interface TimelineLayout {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  nodeRadius: number;
  levelHeight: number;
}
