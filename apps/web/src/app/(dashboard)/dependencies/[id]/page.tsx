'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  GitBranch,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DependencyVisualizer,
  type GraphNode,
  type GraphEdge,
} from '@/components/tasks/task-dependency-visualizer';

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  cycles: boolean;
}

export default function DependencyGraphPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [taskTitle, setTaskTitle] = useState('');

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, taskRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}/dependencies/deep`),
        fetch(`/api/tasks/${taskId}`),
      ]);

      if (!graphRes.ok) {
        throw new Error(graphRes.status === 404 ? 'Task not found' : 'Failed to load graph');
      }

      const graphData = await graphRes.json();
      setNodes(graphData.nodes ?? []);
      setEdges(graphData.edges ?? []);
      setStats(graphData.stats ?? null);

      if (taskRes.ok) {
        const taskData = await taskRes.json();
        setTaskTitle(taskData.task?.title ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dependency graph');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    startTransition(() => {
      fetchGraph();
    });
  }, [fetchGraph]);

  const statusCounts = nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.status] = (acc[n.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/tasks/${taskId}`}
            className="border-surface-300/20 bg-surface-100/80 text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 flex h-9 w-9 items-center justify-center rounded-xl border transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-surface-900 text-lg font-semibold">
                {loading ? 'Loading...' : taskTitle || 'Dependency Graph'}
              </h1>
              {!loading && stats && (
                <Badge variant="info" size="sm">
                  <GitBranch className="mr-0.5 h-3 w-3" />
                  {stats.totalNodes} nodes
                </Badge>
              )}
            </div>
            <p className="text-surface-500 mt-0.5 text-sm">
              Visual exploration of task relationships and dependencies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGraph}
            disabled={loading}
            className="h-8 rounded-lg text-xs"
          >
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Link href={`/tasks/${taskId}`}>
            <Button size="sm" className="h-8 rounded-lg text-xs">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              View Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && !error && stats && stats.totalNodes > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-4"
        >
          {[
            { label: 'Total Nodes', value: stats.totalNodes, icon: GitBranch },
            { label: 'Total Edges', value: stats.totalEdges, icon: GitBranch },
            { label: 'Max Depth', value: stats.maxDepth, icon: Info },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-surface-300/20 bg-surface-100/50 flex items-center gap-2 rounded-xl border px-3 py-1.5"
            >
              <stat.icon className="text-surface-400 h-3.5 w-3.5" />
              <span className="text-surface-500 text-xs">{stat.label}</span>
              <span className="text-surface-900 text-sm font-semibold tabular-nums">{stat.value}</span>
            </div>
          ))}

          {stats.cycles && (
            <div className="border-amber-500/20 bg-amber-500/5 flex items-center gap-2 rounded-xl border px-3 py-1.5">
              <AlertTriangle className="text-amber-500 h-3.5 w-3.5" />
              <span className="text-amber-600 text-xs font-medium">Cycle detected</span>
            </div>
          )}

          {/* Status breakdown */}
          {Object.entries(statusCounts).length > 0 && (
            <div className="flex items-center gap-1.5">
              {Object.entries(statusCounts).slice(0, 5).map(([status, count]) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-200/50 px-2 py-0.5 text-[9px] font-medium text-surface-500"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{
                    backgroundColor: (
                      {
                        draft: '#a8a29e',
                        open: '#60a5fa',
                        todo: '#60a5fa',
                        in_progress: '#fbbf24',
                        blocked: '#f87171',
                        under_review: '#22d3ee',
                        completed: '#34d399',
                        closed: '#6b7280',
                      } as Record<string, string>
                    )[status] ?? '#a8a29e'
                  }} />
                  {status.replace(/_/g, ' ')} {count}
                </span>
              ))}
              {Object.keys(statusCounts).length > 5 && (
                <span className="text-surface-500 text-[9px]">
                  +{Object.keys(statusCounts).length - 5} more
                </span>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Graph */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <DependencyVisualizer
          taskId={taskId}
          nodes={nodes}
          edges={edges}
          stats={stats}
          loading={loading}
          error={error}
          onRefresh={fetchGraph}
          fullScreen
          rootTaskId={taskId}
        />
      </motion.div>

      {/* Info panel */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="border-surface-300/20 rounded-xl border p-4"
        >
          <div className="flex items-start gap-3">
            <Info className="text-surface-400 mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1 text-xs text-surface-500">
              <p>
                <strong className="text-surface-700">Nodes</strong> represent tasks. The root task (current task) has a dashed ring.
                <strong className="text-surface-700 ml-2">Edges</strong> represent dependency relationships — solid red lines for &quot;blocks&quot; and dashed indigo lines for other types.
              </p>
              <p>
                <strong className="text-surface-700">Hover</strong> a node to highlight its connections. <strong className="text-surface-700">Drag</strong> nodes to rearrange the layout.
                <strong className="text-surface-700 ml-2">Double-click</strong> a node to navigate to that task. Use the mouse wheel to zoom.
              </p>
              {stats && stats.totalNodes >= 100 && (
                <p className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  Graph is large — performance may be limited. The maximum display is 100 nodes.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}


