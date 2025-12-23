/**
 * Timeline Event Card - Expanded event details
 */

'use client';

import React from 'react';
import { TimelineEvent } from '@/types/timeline';
import { getEventColor, getEventIcon, getEventTypeLabel, formatTimestamp } from '@/lib/timeline-utils';
import { X } from 'lucide-react';

interface TimelineEventCardProps {
  event: TimelineEvent;
  relatedEvents?: TimelineEvent[];
  onClose: () => void;
  onSelectRelated?: (eventId: string) => void;
}

export function TimelineEventCard({
  event,
  relatedEvents = [],
  onClose,
  onSelectRelated
}: TimelineEventCardProps) {
  const color = getEventColor(event.type);
  const icon = getEventIcon(event.type);
  const typeLabel = getEventTypeLabel(event.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-[#1F2937] rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        style={{ border: `2px solid ${color}` }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1F2937] border-b border-gray-700 p-6 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{icon}</span>
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {typeLabel}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{event.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{event.author}</span>
              <span>•</span>
              <span>{formatTimestamp(event.timestamp, 'long')}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Content</h3>
            <p className="text-gray-200 leading-relaxed">{event.content}</p>
          </div>

          {/* Metadata */}
          {event.metadata && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Details</h3>
              <div className="space-y-2">
                {event.metadata.channel && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Channel:</span>
                    <span className="text-gray-200 font-mono text-sm">
                      {event.metadata.channel}
                    </span>
                  </div>
                )}
                {event.metadata.recipients && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500">Recipients:</span>
                    <span className="text-gray-200 text-sm">
                      {event.metadata.recipients.join(', ')}
                    </span>
                  </div>
                )}
                {event.metadata.tags && event.metadata.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500">Tags:</span>
                    <div className="flex flex-wrap gap-2">
                      {event.metadata.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source URL */}
          {event.sourceUrl && (
            <div className="mb-6">
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <span>View Source</span>
                <span>→</span>
              </a>
            </div>
          )}

          {/* Related Events */}
          {relatedEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                Related Events ({relatedEvents.length})
              </h3>
              <div className="space-y-2">
                {relatedEvents.map((relatedEvent) => {
                  const relatedColor = getEventColor(relatedEvent.type);
                  const relatedIcon = getEventIcon(relatedEvent.type);

                  return (
                    <button
                      key={relatedEvent.id}
                      onClick={() => onSelectRelated?.(relatedEvent.id)}
                      className="w-full text-left p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{relatedIcon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm mb-1">
                            {relatedEvent.title}
                          </div>
                          <div className="text-xs text-gray-400">
                            {relatedEvent.author} • {formatTimestamp(relatedEvent.timestamp)}
                          </div>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: relatedColor }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
