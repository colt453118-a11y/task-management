'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEP_GRAPH } from '@/lib/test-ids';

// ─── Types ──────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  title: string;
  taskIdDisplay: string;
  status: string;
  priority: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  dependencyType: string;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  cycles: boolean;
}

interface ForceNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  radius: number;
  depth: number;
}

interface ForceEdge extends GraphEdge {
  sourceNode: ForceNode;
  targetNode: ForceNode;
}

// ─── Status helpers ─────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: '#a8a29e', label: 'Draft' },
  open: { color: '#60a5fa', label: 'Open' },
  todo: { color: '#60a5fa', label: 'To Do' },
  in_progress: { color: '#fbbf24', label: 'In Progress' },
  blocked: { color: '#f87171', label: 'Blocked' },
  under_review: { color: '#22d3ee', label: 'Review' },
  on_hold: { color: '#fb923c', label: 'On Hold' },
  completed: { color: '#34d399', label: 'Completed' },
  closed: { color: '#6b7280', label: 'Closed' },
  reopened: { color: '#c084fc', label: 'Reopened' },
  cancelled: { color: '#a8a29e', label: 'Cancelled' },
  archived: { color: '#78716c', label: 'Archived' },
};

const DEFAULT_STATUS_COLOR = '#a8a29e';

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { color: DEFAULT_STATUS_COLOR, label: 'Unknown' };
}

// ─── Physics Constants ──────────────────────────────────────

const REPULSION_STRENGTH = 3000;
const ATTRACTION_STRENGTH = 0.005;
const CENTERING_STRENGTH = 0.001;
const DAMPING = 0.85;
const MIN_VELOCITY = 0.1;
const NODE_RADIUS = 28;

// ═══════════════════════════════════════════════════════════════
//  FORCE SIMULATION
// ═══════════════════════════════════════════════════════════════

function runSimulation(
  nodes: ForceNode[],
  edges: ForceEdge[],
  width: number,
  height: number,
): boolean {
  const cx = width / 2;
  const cy = height / 2;
  let moved = false;

  // Repulsion (Coulomb's law)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) { dist = 1; dx = Math.random() - 0.5; dy = Math.random() - 0.5; }
      const force = REPULSION_STRENGTH / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // Attraction along edges (spring)
  for (const edge of edges) {
    const dx = edge.targetNode.x - edge.sourceNode.x;
    const dy = edge.targetNode.y - edge.sourceNode.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;
    const force = ATTRACTION_STRENGTH * dist;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    edge.sourceNode.vx += fx;
    edge.sourceNode.vy += fy;
    edge.targetNode.vx -= fx;
    edge.targetNode.vy -= fy;
  }

  // Centering force
  for (const node of nodes) {
    if (node.fx !== null || node.fy !== null) continue;
    node.vx += (cx - node.x) * CENTERING_STRENGTH;
    node.vy += (cy - node.y) * CENTERING_STRENGTH;
  }

  // Apply velocity with damping
  for (const node of nodes) {
    if (node.fx !== null) { node.x = node.fx; node.vx = 0; }
    else { node.vx *= DAMPING; node.x += node.vx; }

    if (node.fy !== null) { node.y = node.fy; node.vy = 0; }
    else { node.vy *= DAMPING; node.y += node.vy; }

    const margin = 60;
    node.x = Math.max(margin, Math.min(width - margin, node.x));
    node.y = Math.max(margin, Math.min(height - margin, node.y));

    if (Math.abs(node.vx) > MIN_VELOCITY || Math.abs(node.vy) > MIN_VELOCITY) {
      moved = true;
    }
  }

  return moved;
}

// ═══════════════════════════════════════════════════════════════
//  LAYOUT COMPUTATION
// ═══════════════════════════════════════════════════════════════

function computeLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
  width: number,
  height: number,
): { nodes: ForceNode[]; edges: ForceEdge[] } {
  if (graphNodes.length === 0) return { nodes: [], edges: [] };

  const cx = width / 2;
  const cy = height / 2;

  const forceNodes: ForceNode[] = graphNodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / graphNodes.length;
    const radius = Math.min(width, height) * 0.3;
    return {
      ...n,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      radius: NODE_RADIUS,
      depth: 0,
    };
  });

  const nodeMap = new Map<string, ForceNode>();
  forceNodes.forEach((n) => nodeMap.set(n.id, n));

  const forceEdges: ForceEdge[] = [];
  for (const e of graphEdges) {
    const source = nodeMap.get(e.source);
    const target = nodeMap.get(e.target);
    if (source && target) {
      forceEdges.push({ ...e, sourceNode: source, targetNode: target });
    }
  }

  const MAX_ITERATIONS = 300;
  let iteration = 0;
  let moving = true;
  while (moving && iteration < MAX_ITERATIONS) {
    moving = runSimulation(forceNodes, forceEdges, width, height);
    iteration++;
  }

  // Assign depths based on BFS from root nodes
  const inDegree = new Map<string, number>();
  for (const node of forceNodes) inDegree.set(node.id, 0);
  for (const edge of forceEdges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  const visited = new Set<string>();
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
      visited.add(id);
    }
  }

  let depthLevel = 0;
  while (queue.length > 0) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const id = queue.shift()!;
      const node = nodeMap.get(id);
      if (node) node.depth = depthLevel;
      for (const edge of forceEdges) {
        if (edge.source === id && !visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    depthLevel++;
  }

  return { nodes: forceNodes, edges: forceEdges };
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface DependencyVisualizerProps {
  taskId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  fullScreen?: boolean;
  rootTaskId?: string;
}

export function DependencyVisualizer({
  taskId,
  nodes: graphNodes,
  edges: graphEdges,
  stats,
  loading,
  error,
  onRefresh,
  fullScreen = false,
  rootTaskId,
}: DependencyVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [simulationDone, setSimulationDone] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear state when data changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSimulationDone(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [graphNodes.length, graphEdges.length]);

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compute initial layout
  const layout = useMemo(() => {
    if (graphNodes.length === 0 || (dimensions.width <= 0 || dimensions.height <= 0)) {
      return { nodes: [], edges: [] };
    }
    return computeLayout(graphNodes, graphEdges, dimensions.width, dimensions.height);
     
  }, [graphNodes, graphEdges, dimensions.width, dimensions.height]);

  // Run live simulation ticks for spring animation
  const liveNodesRef = useRef<ForceNode[]>([]);
  const liveEdgesRef = useRef<ForceEdge[]>([]);
  const [liveNodes, setLiveNodes] = useState<ForceNode[]>([]);
  const [liveEdges, setLiveEdges] = useState<ForceEdge[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    liveNodesRef.current = layout.nodes.map((n) => ({ ...n, vx: 0, vy: 0 }));
    liveEdgesRef.current = layout.edges.map((e) => ({
      ...e,
      sourceNode: liveNodesRef.current.find((n) => n.id === e.source)!,
      targetNode: liveNodesRef.current.find((n) => n.id === e.target)!,
    }));
    setLiveNodes([...liveNodesRef.current]);
    setLiveEdges([...liveEdgesRef.current]);
    setSimulationDone(false);

    let tick = 0;
    const MAX_TICKS = 120;
    const simulate = () => {
      if (tick >= MAX_TICKS) {
        setSimulationDone(true);
        return;
      }
      const moved = runSimulation(
        liveNodesRef.current,
        liveEdgesRef.current,
        dimensions.width,
        dimensions.height,
      );
      setLiveNodes([...liveNodesRef.current]);
      setLiveEdges([...liveEdgesRef.current]);
      tick++;
      if (moved || tick < 60) {
        animFrameRef.current = requestAnimationFrame(simulate);
      } else {
        setSimulationDone(true);
      }
    };

    animFrameRef.current = requestAnimationFrame(simulate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [layout, dimensions]);

  // ── Drag handling ─────────────────────────────────────────

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      setDragNode(nodeId);
      const node = liveNodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.fx = node.x;
        node.fy = node.y;
      }
    },
    [],
  );

  useEffect(() => {
    if (!dragNode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale - offset.x;
      const y = (e.clientY - rect.top) / scale - offset.y;
      const node = liveNodesRef.current.find((n) => n.id === dragNode);
      if (node) {
        node.fx = x;
        node.fy = y;
        node.x = x;
        node.y = y;
        setLiveNodes([...liveNodesRef.current]);
      }
    };

    const handleMouseUp = () => {
      const node = liveNodesRef.current.find((n) => n.id === dragNode);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      setDragNode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragNode, scale, offset]);

  // ── Pan handling ──────────────────────────────────────────

  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setPanning(true);
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  }, [offset]);

  useEffect(() => {
    if (!panning) return;
    const handleMove = (e: MouseEvent) => {
      setOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    };
    const handleUp = () => setPanning(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [panning]);

  // ── Zoom ──────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.3, Math.min(3, s - e.deltaY * 0.002)));
  }, []);

  // ── Hover/selected path highlighting ─────────────────────

  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setHoveredNode(nodeId);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    tooltipTimeoutRef.current = setTimeout(() => setHoveredNode(null), 100);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    window.open(`/tasks/${nodeId}`, fullScreen ? '_blank' : '_self');
  }, [fullScreen]);

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const id = hoveredNode ?? selectedNode;
    if (!id) return new Set<string>();
    const connected = new Set<string>([id]);
    // eslint-disable-next-line react-hooks/refs
    for (const edge of liveEdgesRef.current) {
      if (edge.source === id) connected.add(edge.target);
      if (edge.target === id) connected.add(edge.source);
    }
    return connected;
  }, [hoveredNode, selectedNode]);

  const highlightedEdgeIds = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const id = hoveredNode ?? selectedNode;
    if (!id) return new Set<string>();
    const edgeIds = new Set<string>();
    // eslint-disable-next-line react-hooks/refs
    for (const edge of liveEdgesRef.current) {
      if (edge.source === id || edge.target === id) {
        edgeIds.add(edge.id);
      }
    }
    return edgeIds;
  }, [hoveredNode, selectedNode]);

  const isRootNode = (nodeId: string) => nodeId === (rootTaskId ?? taskId);

  // ── Loading / Error states ────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="text-brand-500 h-8 w-8 animate-spin" />
            <span className="bg-brand-500/20 absolute inset-0 animate-ping rounded-full" />
          </div>
          <p className="text-surface-500 text-sm font-medium">Loading dependency graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-12">
        <AlertCircle className="text-error mb-3 h-8 w-8" />
        <p className="text-error text-sm font-medium">{error}</p>
        <button
          onClick={onRefresh}
          className="text-brand-500 hover:text-brand-400 mt-3 text-xs font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (graphNodes.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <GitBranch className="text-surface-400 mb-3 h-10 w-10" />
        <p className="text-surface-500 text-sm font-medium">No dependencies found</p>
        <p className="text-surface-500 mt-1 text-xs">
          This task has no upstream or downstream dependencies.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  const { width, height } = dimensions;

  return (
    <div className="space-y-3">
      {/* Controls Bar */}
      {fullScreen && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="text-brand-500 h-4 w-4" />
            <span className="text-surface-900 text-sm font-semibold">Dependency Graph</span>
            {stats && (
              <span className="text-surface-500 text-xs">
                {stats.totalNodes} nodes &middot; {stats.totalEdges} edges &middot; depth {stats.maxDepth}
                {stats.cycles && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-500">
                    <AlertTriangle className="h-3 w-3" /> cycle detected
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              className="text-surface-500 hover:text-surface-700 hover:bg-surface-200/50 rounded-lg p-1.5 transition-all"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}
              className="text-surface-500 hover:text-surface-700 hover:bg-surface-200/50 rounded-lg p-1.5 transition-all"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-surface-500 min-w-[3rem] text-center text-xs tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
              className="text-surface-500 hover:text-surface-700 hover:bg-surface-200/50 rounded-lg p-1.5 transition-all"
              title="Reset view"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Graph container */}
      <div
        ref={containerRef}
        data-testid={DEP_GRAPH.graphView}
        className={cn(
          'relative overflow-hidden rounded-xl border',
          fullScreen
            ? 'h-[65vh] border-surface-300/20 bg-surface-100/30'
            : 'h-[350px] border-surface-300/10 bg-surface-100/20',
          panning ? 'cursor-grabbing' : dragNode ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Stats overlay */}
        {!fullScreen && stats && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-2 rounded-lg bg-black/40 px-2 py-1 backdrop-blur-sm">
            <span className="text-[10px] font-medium text-white/80">
              {stats.totalNodes} nodes
            </span>
            <span className="text-white/30">&middot;</span>
            <span className="text-[10px] font-medium text-white/80">
              {stats.totalEdges} edges
            </span>
            {stats.cycles && (
              <>
                <span className="text-white/30">&middot;</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" /> cycle
                </span>
              </>
            )}
          </div>
        )}

        {/* Simulation progress */}
        {!simulationDone && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 backdrop-blur-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-[10px] font-medium text-white/70">Laying out graph...</span>
            </div>
          </div>
        )}

        {/* SVG */}
        <svg
          width={width}
          height={height}
          className="h-full w-full"
          style={{ cursor: panning ? 'grabbing' : dragNode ? 'grabbing' : 'grab' }}
        >
          <g
            transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}
            style={{ transformOrigin: 'center center' }}
          >
            {/* Edges layer */}
            {liveEdges.map((edge) => {
              const isHighlighted = highlightedEdgeIds.has(edge.id);
              const isDimmed = (hoveredNode || selectedNode) && !isHighlighted;
              const isBlocks = edge.dependencyType === 'blocks';

              return (
                <g key={edge.id}>
                  {/* Edge line */}
                  <motion.line
                    x1={edge.sourceNode.x}
                    y1={edge.sourceNode.y}
                    x2={edge.targetNode.x}
                    y2={edge.targetNode.y}
                    initial={false}
                    animate={{
                      x1: edge.sourceNode.x,
                      y1: edge.sourceNode.y,
                      x2: edge.targetNode.x,
                      y2: edge.targetNode.y,
                    }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.5 }}
                    className={cn(
                      'transition-all duration-200',
                      isDimmed ? 'opacity-10' : 'opacity-40',
                      isHighlighted && 'opacity-80',
                    )}
                    stroke={isBlocks ? '#f87171' : '#6366f1'}
                    strokeWidth={isHighlighted ? 2.5 : isBlocks ? 2 : 1.5}
                    strokeDasharray={isBlocks ? 'none' : '6,3'}
                    strokeLinecap="round"
                  />

                  {/* Arrowhead */}
                  <motion.polygon
                    initial={false}
                    animate={{
                      points: getArrowPoints(
                        edge.targetNode.x,
                        edge.targetNode.y,
                        edge.sourceNode.x,
                        edge.sourceNode.y,
                        (edge.targetNode.radius ?? NODE_RADIUS) + 4,
                      ),
                    }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.5 }}
                    fill={isBlocks ? '#f87171' : '#6366f1'}
                    opacity={isDimmed ? 0.1 : isHighlighted ? 0.9 : 0.4}
                  />

                  {/* Edge label */}
                  {isHighlighted && edge.dependencyType !== 'blocks' && (
                    <motion.text
                      x={(edge.sourceNode.x + edge.targetNode.x) / 2}
                      y={(edge.sourceNode.y + edge.targetNode.y) / 2 - 8}
                      initial={false}
                      animate={{
                        x: (edge.sourceNode.x + edge.targetNode.x) / 2,
                        y: (edge.sourceNode.y + edge.targetNode.y) / 2 - 8,
                      }}
                      textAnchor="middle"
                      className="fill-surface-500 text-[8px] font-medium"
                    >
                      {edge.dependencyType.replace(/_/g, ' ')}
                    </motion.text>
                  )}
                </g>
              );
            })}

            {/* Nodes layer */}
            {liveNodes.map((node) => {
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode === node.id;
              const isConnected = connectedNodeIds.has(node.id);
              const isDimmed = (hoveredNode || selectedNode) && !isConnected;
              const isRoot = isRootNode(node.id);
              const statusCfg = getStatusConfig(node.status);
              const nodeRadius = isRoot ? (node.radius ?? NODE_RADIUS) + 6 : node.radius ?? NODE_RADIUS;

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => handleNodeMouseEnter(node.id)}
                  onMouseLeave={handleNodeMouseLeave}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={() => handleNodeClick(node.id)}
                  onDoubleClick={() => handleNodeDoubleClick(node.id)}
                  style={{ cursor: 'pointer' }}
                  className="select-none"
                >
                  {/* Glow effect */}
                  {(isHovered || isSelected) && (
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeRadius + 8}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: 0.3,
                        scale: 1,
                        cx: node.x,
                        cy: node.y,
                      }}
                      fill={statusCfg.color}
                      className="pointer-events-none"
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    />
                  )}

                  {/* Node circle */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius}
                    initial={false}
                    animate={{
                      cx: node.x,
                      cy: node.y,
                      r: nodeRadius,
                      fill: isDimmed ? '#1c1917' : statusCfg.color,
                      opacity: isDimmed ? 0.25 : isHovered ? 1 : 0.85,
                    }}
                    transition={{ type: 'spring', stiffness: 150, damping: 18, mass: 0.8 }}
                    stroke={isSelected ? '#6366f1' : isRoot ? '#6366f1' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isSelected ? 3 : isRoot ? 2.5 : 1.5}
                    className="transition-shadow duration-200"
                    style={{ filter: isHovered ? 'drop-shadow(0 0 6px rgba(99,102,241,0.4))' : 'none' }}
                  />

                  {/* Root indicator ring */}
                  {isRoot && (
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeRadius + 2}
                      initial={false}
                      animate={{ cx: node.x, cy: node.y }}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth={1.5}
                      strokeDasharray="4,3"
                      opacity={0.5}
                    />
                  )}

                  {/* Priority indicator */}
                  {node.priority === 'urgent' || node.priority === 'critical' ? (
                    <motion.text
                      x={node.x}
                      y={node.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      initial={false}
                      animate={{ x: node.x, y: node.y + 1 }}
                      className="fill-white text-[10px] font-bold"
                    >
                      !
                    </motion.text>
                  ) : node.priority === 'high' ? (
                    <motion.text
                      x={node.x}
                      y={node.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      initial={false}
                      animate={{ x: node.x, y: node.y + 1 }}
                      className="fill-white/90 text-[9px] font-semibold"
                    >
                      {'\u2191'}
                    </motion.text>
                  ) : (
                    <motion.text
                      x={node.x}
                      y={node.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      initial={false}
                      animate={{ x: node.x, y: node.y + 1 }}
                      className="fill-white/70 text-[8px] font-medium"
                    >
                      {node.taskIdDisplay.replace('TASK-', '').slice(0, 4)}
                    </motion.text>
                  )}

                  {/* Node label */}
                  <motion.g
                    initial={false}
                    animate={{ opacity: isDimmed ? 0.3 : 1 }}
                  >
                    <motion.text
                      x={node.x}
                      y={node.y + nodeRadius + 14}
                      textAnchor="middle"
                      initial={false}
                      animate={{ x: node.x, y: node.y + nodeRadius + 14 }}
                      className={cn(
                        'text-[10px] font-medium leading-tight',
                        isSelected
                          ? 'fill-brand-500'
                          : isRoot
                            ? 'fill-surface-800 dark:fill-surface-200'
                            : 'fill-surface-600 dark:fill-surface-300',
                      )}
                    >
                      {node.title.length > 22 ? node.title.slice(0, 20) + '\u2026' : node.title}
                    </motion.text>

                    <motion.text
                      x={node.x}
                      y={node.y + nodeRadius + 26}
                      textAnchor="middle"
                      initial={false}
                      animate={{ x: node.x, y: node.y + nodeRadius + 26 }}
                      className="fill-surface-500 text-[7px]"
                    >
                      {node.taskIdDisplay}
                    </motion.text>
                  </motion.g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Empty state during computation */}
        {!loading && graphNodes.length > 0 && liveNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-brand-500 h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-surface-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#f87171]" />
          <span>Blocks relation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #6366f1 0, #6366f1 3px, transparent 3px, transparent 6px)',
            }}
          />
          <span>Relates to / duplicates</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full border border-dashed border-[#6366f1] text-[6px] text-[#6366f1]">
            {'\u2713'}
          </span>
          <span>Root task</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-surface-400">Scroll</span>
          <span>to zoom &middot;</span>
          <span className="text-surface-400">Drag</span>
          <span>canvas to pan &middot;</span>
          <span className="text-surface-400">Drag</span>
          <span>nodes to rearrange</span>
        </div>
      </div>
    </div>
  );
}

// ─── Arrow helper ───────────────────────────────────────────

function getArrowPoints(
  tx: number,
  ty: number,
  sx: number,
  sy: number,
  offsetRadius: number,
): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / dist;
  const uy = dy / dist;

  const tipX = tx - ux * offsetRadius;
  const tipY = ty - uy * offsetRadius;
  const size = 6;
  const leftX = tipX - ux * size + uy * size * 0.5;
  const leftY = tipY - uy * size - ux * size * 0.5;
  const rightX = tipX - ux * size - uy * size * 0.5;
  const rightY = tipY - uy * size + ux * size * 0.5;

  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}
