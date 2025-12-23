/**
 * Timeline Node Component - Individual event visualization
 */

'use client';

import React, { useState } from 'react';
import { TimelineEvent } from '@/types/timeline';
import { getEventColor, getEventIcon, formatRelativeTime, truncateText } from '@/lib/timeline-utils';

interface TimelineNodeProps {
  event: TimelineEvent;
  x: number;
  y: number;
  onClick: () => void;
  isSelected: boolean;
}

export function TimelineNode({ event, x, y, onClick, isSelected }: TimelineNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const color = getEventColor(event.type);
  const icon = getEventIcon(event.type);
  const radius = isSelected ? 14 : isHovered ? 12 : 10;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Outer glow for selected state */}
      {isSelected && (
        <circle
          r={radius + 6}
          fill={color}
          opacity={0.2}
          style={{
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Main circle */}
      <circle
        r={radius}
        fill={color}
        stroke={isSelected ? '#fff' : color}
        strokeWidth={isSelected ? 2 : 1}
        opacity={isHovered || isSelected ? 1 : 0.9}
        style={{
          transition: 'all 0.3s ease',
          filter: isHovered ? 'brightness(1.2)' : 'none',
        }}
      />

      {/* Icon (emoji) */}
      <text
        textAnchor="middle"
        dy="0.3em"
        fontSize={radius}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {icon}
      </text>

      {/* Hover tooltip */}
      {isHovered && (
        <g>
          <foreignObject
            x={15}
            y={-30}
            width={250}
            height={80}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                background: '#1F2937',
                border: `2px solid ${color}`,
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px', color }}>
                {truncateText(event.title, 35)}
              </div>
              <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}>
                {formatRelativeTime(event.timestamp)} • {event.author}
              </div>
              <div style={{ fontSize: '11px', color: '#D1D5DB' }}>
                {truncateText(event.content, 80)}
              </div>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
}
