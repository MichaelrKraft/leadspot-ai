'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  date: string;
  count: number;
}

interface UsageChartProps {
  data: DataPoint[];
  title: string;
  type?: 'line' | 'bar';
  color?: string;
}

export default function UsageChart({
  data,
  title,
  type = 'line',
  color = '#3b82f6',
}: UsageChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates
    const parseDate = d3.timeParse('%Y-%m-%d');
    const parsedData = data.map((d) => ({
      date: parseDate(d.date)!,
      count: d.count,
    }));

    // Create scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(parsedData, (d) => d.count) as number])
      .nice()
      .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6b7280');

    svg
      .append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6b7280');

    // Add grid lines
    svg
      .append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(() => ''));

    if (type === 'line') {
      // Create line
      const line = d3
        .line<{ date: Date; count: number }>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.count))
        .curve(d3.curveMonotoneX);

      // Add line path
      svg
        .append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add dots
      svg
        .selectAll('.dot')
        .data(parsedData)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yScale(d.count))
        .attr('r', 4)
        .attr('fill', color)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this).attr('r', 6);

          if (tooltipRef.current) {
            const tooltip = d3.select(tooltipRef.current);
            tooltip
              .style('display', 'block')
              .style('left', `${event.pageX + 10}px`)
              .style('top', `${event.pageY - 30}px`)
              .html(
                `<strong>${d3.timeFormat('%b %d, %Y')(d.date)}</strong><br/>Count: ${d.count}`
              );
          }
        })
        .on('mouseout', function () {
          d3.select(this).attr('r', 4);
          if (tooltipRef.current) {
            d3.select(tooltipRef.current).style('display', 'none');
          }
        });
    } else if (type === 'bar') {
      // Create bars
      svg
        .selectAll('.bar')
        .data(parsedData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => xScale(d.date) - 10)
        .attr('y', (d) => yScale(d.count))
        .attr('width', 20)
        .attr('height', (d) => height - yScale(d.count))
        .attr('fill', color)
        .attr('opacity', 0.8)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this).attr('opacity', 1);

          if (tooltipRef.current) {
            const tooltip = d3.select(tooltipRef.current);
            tooltip
              .style('display', 'block')
              .style('left', `${event.pageX + 10}px`)
              .style('top', `${event.pageY - 30}px`)
              .html(
                `<strong>${d3.timeFormat('%b %d, %Y')(d.date)}</strong><br/>Count: ${d.count}`
              );
          }
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 0.8);
          if (tooltipRef.current) {
            d3.select(tooltipRef.current).style('display', 'none');
          }
        });
    }
  }, [data, type, color]);

  return (
    <div className="relative">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <svg ref={svgRef} className="w-full" />
      <div
        ref={tooltipRef}
        className="absolute bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none"
        style={{ display: 'none' }}
      />
    </div>
  );
}
