/**
 * Knowledge Graph Page - Interactive visualization of decision relationships
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
  GitBranch,
  Users,
  Briefcase,
  Target,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { GraphStats, Decision } from '@/types/decision';

// Node types for the graph
type NodeType = 'decision' | 'person' | 'project' | 'factor';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

// Stats Card Component
function StatsCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

// Simple force-directed graph visualization
function ForceGraph({
  nodes,
  edges,
  onNodeClick,
  selectedTypes,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
  selectedTypes: NodeType[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const nodesRef = useRef<GraphNode[]>([]);

  // Filter nodes by selected types
  const filteredNodes = nodes.filter((n) => selectedTypes.includes(n.type));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );

  // Node colors by type
  const nodeColors: Record<NodeType, string> = {
    decision: '#3B82F6', // blue
    person: '#10B981', // green
    project: '#8B5CF6', // purple
    factor: '#F59E0B', // orange
  };

  // Initialize positions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize node positions in a circle
    nodesRef.current = filteredNodes.map((node, i) => ({
      ...node,
      x: width / 2 + Math.cos((i / filteredNodes.length) * Math.PI * 2) * 200,
      y: height / 2 + Math.sin((i / filteredNodes.length) * Math.PI * 2) * 200,
      vx: 0,
      vy: 0,
    }));
  }, [filteredNodes]);

  // Force simulation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const simulate = () => {
      const nodes = nodesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Apply forces
      nodes.forEach((node) => {
        // Center gravity
        node.vx += (width / 2 - node.x) * 0.001;
        node.vy += (height / 2 - node.y) * 0.001;

        // Repulsion from other nodes
        nodes.forEach((other) => {
          if (node.id === other.id) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        });
      });

      // Apply edge attraction
      filteredEdges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.01;

        source.vx += (dx / dist) * force;
        source.vy += (dy / dist) * force;
        target.vx -= (dx / dist) * force;
        target.vy -= (dy / dist) * force;
      });

      // Update positions with damping
      nodes.forEach((node) => {
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraints
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      });

      // Clear canvas
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(0, 0, width, height);

      // Apply zoom and offset
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Draw edges
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 1;
      filteredEdges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((node) => {
        const radius = node.type === 'decision' ? 20 : 12;

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = nodeColors[node.type];
        ctx.fill();

        // Node border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label,
          node.x,
          node.y + radius + 15
        );
      });

      ctx.restore();

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [filteredNodes, filteredEdges, zoom, offset]);

  // Handle canvas click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    // Find clicked node
    const clickedNode = nodesRef.current.find((node) => {
      const radius = node.type === 'decision' ? 20 : 12;
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });

    if (clickedNode) {
      onNodeClick(clickedNode);
    }
  };

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="w-full cursor-move rounded-lg"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          className="rounded-lg bg-gray-700 p-2 text-white hover:bg-gray-600"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          className="rounded-lg bg-gray-700 p-2 text-white hover:bg-gray-600"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
          className="rounded-lg bg-gray-700 p-2 text-white hover:bg-gray-600"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<NodeType[]>([
    'decision',
    'person',
    'project',
    'factor',
  ]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, decisionsRes] = await Promise.all([
        api.decisions.getGraphStats(),
        api.decisions.list({ page_size: 100 }),
      ]);

      setStats(statsRes.data as GraphStats);
      const decisionList = decisionsRes.data as { decisions: Decision[] };
      setDecisions(decisionList.decisions);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setError('Failed to load graph data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate graph nodes and edges from decisions
  const generateGraphData = useCallback(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, boolean>();

    decisions.forEach((decision) => {
      // Add decision node
      if (!nodeMap.has(decision.id)) {
        nodes.push({
          id: decision.id,
          type: 'decision',
          label: decision.title,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          connections: [],
        });
        nodeMap.set(decision.id, true);
      }

      // Add factor nodes
      decision.factors.forEach((factor) => {
        const factorId = `factor-${factor.id}`;
        if (!nodeMap.has(factorId)) {
          nodes.push({
            id: factorId,
            type: 'factor',
            label: factor.name,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            connections: [],
          });
          nodeMap.set(factorId, true);
        }
        edges.push({
          source: decision.id,
          target: factorId,
          type: 'has_factor',
        });
      });
    });

    // Add some mock people and projects for visualization
    if (nodes.length > 0) {
      const mockPeople = ['Sarah Chen', 'Mike Rodriguez', 'Alex Kumar', 'Rachel Kim'];
      const mockProjects = ['Platform Migration', 'AI Integration', 'Enterprise Sales'];

      mockPeople.forEach((name, i) => {
        const id = `person-${i}`;
        nodes.push({
          id,
          type: 'person',
          label: name,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          connections: [],
        });

        // Connect to random decisions
        if (decisions.length > 0) {
          const decisionIndex = i % decisions.length;
          edges.push({
            source: decisions[decisionIndex].id,
            target: id,
            type: 'involves',
          });
        }
      });

      mockProjects.forEach((name, i) => {
        const id = `project-${i}`;
        nodes.push({
          id,
          type: 'project',
          label: name,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          connections: [],
        });

        if (decisions.length > 0) {
          const decisionIndex = i % decisions.length;
          edges.push({
            source: decisions[decisionIndex].id,
            target: id,
            type: 'relates_to',
          });
        }
      });
    }

    return { nodes, edges };
  }, [decisions]);

  const { nodes, edges } = generateGraphData();

  // Toggle node type filter
  const toggleType = (type: NodeType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Handle node click
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/decisions"
            className="mb-4 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Decisions</span>
          </Link>
          <h1 className="mb-2 text-4xl font-bold text-white">Knowledge Graph</h1>
          <p className="text-gray-400">
            Visualize relationships between decisions, people, projects, and factors
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
        >
          <RefreshCw className="h-5 w-5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
        <StatsCard
          icon={GitBranch}
          label="Decisions"
          value={stats?.decisions || 0}
          color="text-blue-400"
        />
        <StatsCard icon={Users} label="People" value={stats?.people || 0} color="text-green-400" />
        <StatsCard
          icon={Briefcase}
          label="Projects"
          value={stats?.projects || 0}
          color="text-purple-400"
        />
        <StatsCard
          icon={Target}
          label="Factors"
          value={stats?.factors || 0}
          color="text-orange-400"
        />
        <StatsCard
          icon={GitBranch}
          label="Relationships"
          value={stats?.relationships || 0}
          color="text-pink-400"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Graph Visualization */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Interactive Graph</h2>

              {/* Filter Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleType('decision')}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    selectedTypes.includes('decision')
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  Decisions
                </button>
                <button
                  onClick={() => toggleType('person')}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    selectedTypes.includes('person')
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => toggleType('project')}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    selectedTypes.includes('project')
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  Projects
                </button>
                <button
                  onClick={() => toggleType('factor')}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    selectedTypes.includes('factor')
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  Factors
                </button>
              </div>
            </div>

            {nodes.length > 0 ? (
              <ForceGraph
                nodes={nodes}
                edges={edges}
                onNodeClick={handleNodeClick}
                selectedTypes={selectedTypes}
              />
            ) : (
              <div className="flex h-[500px] items-center justify-center text-gray-400">
                <div className="text-center">
                  <GitBranch className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No data to visualize yet.</p>
                  <p className="mt-2 text-sm">Create some decisions to see the knowledge graph.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:col-span-1">
          {/* Legend */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <h3 className="mb-4 text-lg font-semibold text-white">Legend</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                <span className="text-gray-300">Decisions</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-gray-300">People</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                <span className="text-gray-300">Projects</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-300">Factors</span>
              </div>
            </div>
          </div>

          {/* Selected Node Info */}
          {selectedNode && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <h3 className="mb-4 text-lg font-semibold text-white">Selected Node</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-400">Type:</span>
                  <span className="ml-2 capitalize text-white">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Label:</span>
                  <span className="ml-2 text-white">{selectedNode.label}</span>
                </div>
                {selectedNode.type === 'decision' && (
                  <Link
                    href={`/decisions/${selectedNode.id}`}
                    className="mt-4 block rounded-lg bg-blue-600 px-4 py-2 text-center text-white transition-colors hover:bg-blue-700"
                  >
                    View Decision
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Info className="h-4 w-4" />
              Instructions
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• Click and drag to pan the view</li>
              <li>• Use zoom buttons to adjust scale</li>
              <li>• Click a node to see details</li>
              <li>• Use filters to show/hide node types</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
