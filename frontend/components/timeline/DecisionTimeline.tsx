/**
 * Decision Timeline - Main D3.js Timeline Visualization
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TimelineEvent, TimelineFilter, TimelineLayout } from '@/types/timeline';
import { TimelineNode } from './TimelineNode';
import { TimelineEventCard } from './TimelineEventCard';
import { TimelineControls } from './TimelineControls';
import {
  calculateNodePositions,
  createTimeScale,
  filterEvents,
  formatTimestamp,
} from '@/lib/timeline-utils';

interface DecisionTimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

export function DecisionTimeline({ events, onEventClick }: DecisionTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<TimelineFilter>({ eventTypes: [] });

  const layout: TimelineLayout = {
    width: dimensions.width,
    height: dimensions.height,
    margin: { top: 60, right: 40, bottom: 60, left: 40 },
    nodeRadius: 10,
    levelHeight: 80,
  };

  // Filter events
  const filteredEvents = filterEvents(events, filter);

  // Calculate node positions
  const nodes = calculateNodePositions(filteredEvents, layout);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 800),
          height: Math.max(height, 400),
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Setup D3 zoom and pan
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        setZoom(event.transform.k);
        setPan({ x: event.transform.x, y: event.transform.y });
      });

    svg.call(zoomBehavior);

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1.3
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        0.7
      );
    }
  };

  const handleFitToScreen = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(500).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      );
    }
  };

  const handleExport = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'decision-timeline.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle event selection
  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = events.find(e => e.id === eventId);
    if (event && onEventClick) {
      onEventClick(event);
    }
  };

  const selectedEvent = selectedEventId
    ? events.find(e => e.id === selectedEventId)
    : null;

  const relatedEvents = selectedEvent?.relatedEvents
    ? events.filter(e => selectedEvent.relatedEvents?.includes(e.id))
    : [];

  // Create time scale for axis
  const timeScale = filteredEvents.length > 0
    ? createTimeScale(filteredEvents, dimensions.width, layout.margin)
    : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <TimelineControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        onExport={handleExport}
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* Timeline Visualization */}
      <div
        ref={containerRef}
        className="bg-[#0A0F1C] rounded-lg border border-gray-800 overflow-hidden"
        style={{ height: '600px' }}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ cursor: 'grab' }}
        >
          <defs>
            {/* Gradient for timeline axis */}
            <linearGradient id="timelineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Timeline axis line */}
            <line
              x1={layout.margin.left}
              y1={layout.height / 2}
              x2={dimensions.width - layout.margin.right}
              y2={layout.height / 2}
              stroke="url(#timelineGradient)"
              strokeWidth={4}
              strokeLinecap="round"
            />

            {/* Time axis labels */}
            {timeScale && (
              <g>
                {timeScale.ticks(6).map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={timeScale(tick)}
                      y1={layout.height / 2 - 10}
                      x2={timeScale(tick)}
                      y2={layout.height / 2 + 10}
                      stroke="#4B5563"
                      strokeWidth={2}
                    />
                    <text
                      x={timeScale(tick)}
                      y={layout.height / 2 + 30}
                      textAnchor="middle"
                      fill="#9CA3AF"
                      fontSize={12}
                      fontWeight="500"
                    >
                      {formatTimestamp(tick)}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Connection lines between related events */}
            {nodes.map(node => (
              node.connections.map(targetId => {
                const targetNode = nodes.find(n => n.id === targetId);
                if (!targetNode) return null;

                return (
                  <line
                    key={`${node.id}-${targetId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="#4B5563"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={0.4}
                  />
                );
              })
            ))}

            {/* Event nodes */}
            {nodes.map(node => (
              <TimelineNode
                key={node.id}
                event={node.event}
                x={node.x}
                y={node.y}
                onClick={() => handleEventClick(node.id)}
                isSelected={selectedEventId === node.id}
              />
            ))}
          </g>
        </svg>

        {/* Empty state */}
        {filteredEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-2">No events match your filters</p>
              <button
                onClick={() => setFilter({ eventTypes: [] })}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Event Card Modal */}
      {selectedEvent && (
        <TimelineEventCard
          event={selectedEvent}
          relatedEvents={relatedEvents}
          onClose={() => setSelectedEventId(null)}
          onSelectRelated={handleEventClick}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-400">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
          <span className="text-gray-300">Document</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
          <span className="text-gray-300">Slack</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#10B981]" />
          <span className="text-gray-300">Email</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
          <span className="text-gray-300">Decision</span>
        </div>
      </div>
    </div>
  );
}
