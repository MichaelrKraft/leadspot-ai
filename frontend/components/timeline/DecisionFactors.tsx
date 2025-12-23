/**
 * Decision Factors Visualization - Pie Chart
 */

'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DecisionFactor } from '@/types/timeline';
import { calculateFactorPercentages } from '@/lib/timeline-utils';

interface DecisionFactorsProps {
  factors: DecisionFactor[];
  width?: number;
  height?: number;
}

const FACTOR_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Green
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#6366F1', // Indigo
];

export function DecisionFactors({ factors, width = 400, height = 400 }: DecisionFactorsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const percentages = calculateFactorPercentages(factors);

  useEffect(() => {
    if (!svgRef.current || factors.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = Math.min(width, height) / 2 - 40;
    const centerX = width / 2;
    const centerY = height / 2;

    const pie = d3.pie<DecisionFactor>()
      .value(d => d.weight)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<DecisionFactor>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);

    const outerArc = d3.arc<d3.PieArcDatum<DecisionFactor>>()
      .innerRadius(radius * 1.1)
      .outerRadius(radius * 1.1);

    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // Create arcs
    const arcs = g.selectAll('.arc')
      .data(pie(factors))
      .enter()
      .append('g')
      .attr('class', 'arc');

    // Add arc paths with animation
    arcs.append('path')
      .attr('d', arc as any)
      .attr('fill', (d, i) => FACTOR_COLORS[i % FACTOR_COLORS.length])
      .attr('stroke', '#0A0F1C')
      .attr('stroke-width', 2)
      .style('opacity', 0.9)
      .on('mouseover', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 1)
          .attr('transform', 'scale(1.05)');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 0.9)
          .attr('transform', 'scale(1)');
      })
      .transition()
      .duration(800)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(interpolate(t) as any) || '';
        };
      });

    // Add percentage labels
    arcs.append('text')
      .attr('transform', d => {
        const pos = arc.centroid(d as any);
        return `translate(${pos})`;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text((d, i) => `${percentages[i].toFixed(0)}%`)
      .style('opacity', 0)
      .transition()
      .delay(800)
      .duration(400)
      .style('opacity', 1);

  }, [factors, width, height, percentages]);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ overflow: 'visible' }}
        />
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {factors.map((factor, index) => (
          <div
            key={factor.id}
            className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: FACTOR_COLORS[index % FACTOR_COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-white text-sm">{factor.name}</span>
                <span className="text-gray-400 text-sm font-mono">
                  {percentages[index].toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-gray-400">{factor.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
