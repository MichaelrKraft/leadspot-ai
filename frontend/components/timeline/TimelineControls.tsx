/**
 * Timeline Controls - Zoom, Filter, Export
 */

'use client';

import React from 'react';
import { EventType, TimelineFilter } from '@/types/timeline';
import { ZoomIn, ZoomOut, Maximize2, Download, Filter } from 'lucide-react';
import { getEventColor, getEventTypeLabel } from '@/lib/timeline-utils';

interface TimelineControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onExport: () => void;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
}

const EVENT_TYPES: EventType[] = ['document', 'slack', 'email', 'decision'];

export function TimelineControls({
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onExport,
  filter,
  onFilterChange,
}: TimelineControlsProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  const toggleEventType = (type: EventType) => {
    const currentTypes = filter.eventTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];

    onFilterChange({ ...filter, eventTypes: newTypes });
  };

  const isTypeSelected = (type: EventType) => {
    return !filter.eventTypes || filter.eventTypes.length === 0 || filter.eventTypes.includes(type);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
        <button
          onClick={onZoomIn}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-gray-300" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-gray-300" />
        </button>
        <button
          onClick={onFitToScreen}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* Filter Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          showFilters ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
      </button>

      {/* Export Button */}
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">Export</span>
      </button>

      {/* Filter Panel */}
      {showFilters && (
        <div className="w-full mt-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Event Types</h3>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map(type => {
              const color = getEventColor(type);
              const label = getEventTypeLabel(type);
              const selected = isTypeSelected(type);

              return (
                <button
                  key={type}
                  onClick={() => toggleEventType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selected
                      ? 'ring-2'
                      : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                    boxShadow: selected ? `0 0 0 2px ${color}` : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Clear Filters */}
          {filter.eventTypes && filter.eventTypes.length > 0 && (
            <button
              onClick={() => onFilterChange({ ...filter, eventTypes: [] })}
              className="mt-3 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
