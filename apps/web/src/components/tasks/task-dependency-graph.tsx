'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  GitBranch,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DEP_GRAPH } from '@/lib/test-ids';

// ─── Types ──────────────────────────────────────────────────

export type DepTask = {
  id: string;
  title: string;
  taskIdDisplay: string;
  status: string;
};

export type Dependency = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: string;
  createdAt: string;
  dependsOnTask?: DepTask;
  blockingTask?: DepTask;
};

interface TaskDependencyGraphProps {
  blockedBy: Dependency[];
  blocking: Dependency[];
  taskId: string;
  onDependencyAdded: () => void;
  onDependencyRemoved: () => void;
}

// ─── Status helpers ─────────────────────────────────────────

const statusColors: Record<string, string> = {
  todo: 'border-l-blue-500 bg-blue-500/5',
  in_progress: 'border-l-amber-500 bg-amber-500/5',
  in_review: 'border-l-purple-500 bg-purple-500/5',
  completed: 'border-l-green-500 bg-green-500/5',
  closed: 'border-l-surface-500 bg-surface-500/5',
  reopened: 'border-l-cyan-500 bg-cyan-500/5',
  archived: 'border-l-slate-500 bg-slate-500/5',
  blocked: 'border-l-red-500 bg-red-500/5',
};

const statusBadgeColors: Record<string, string> = {
  todo: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  in_review: 'bg-purple-500/10 text-purple-400',
  completed: 'bg-green-500/10 text-green-400',
  closed: 'bg-surface-500/10 text-surface-400',
  reopened: 'bg-cyan-500/10 text-cyan-400',
  archived: 'bg-slate-500/10 text-slate-400',
  blocked: 'bg-red-500/10 text-red-400',
};

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
  closed: 'Closed',
  reopened: 'Reopened',
  archived: 'Archived',
  blocked: 'Blocked',
};

// ─── Graph Layout Helpers ───────────────────────────────────





// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function TaskDependencyGraph({
  blockedBy,
  blocking,
  taskId,
  onDependencyAdded,
  onDependencyRemoved,
}: TaskDependencyGraphProps) {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const hasDeps = blockedBy.length > 0 || blocking.length > 0;
  const totalDeps = blockedBy.length + blocking.length;

  // ── Remove dependency ─────────────────────────────────
  const handleRemove = useCallback(async (depId: string) => {
    setRemovingId(depId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies?dependencyId=${depId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove dependency');
      onDependencyRemoved();
    } catch (err) {
      console.error('Failed to remove dependency:', err);
    } finally {
      setRemovingId(null);
    }
  }, [taskId, onDependencyRemoved]);

  return (
    <div className="space-y-3" data-testid={DEP_GRAPH.root}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="text-surface-400 h-4 w-4" />
          <span className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
            Dependencies
          </span>
          {hasDeps && (
            <span className="text-surface-500 text-xs" data-testid={DEP_GRAPH.count}>({totalDeps})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="border-surface-300/20 flex gap-0.5 rounded-lg border p-0.5" data-testid={DEP_GRAPH.viewToggle}>
            <button
              onClick={() => setViewMode('graph')}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                viewMode === 'graph'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200/50'
              }`}
              data-testid={DEP_GRAPH.toggleGraph}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200/50'
              }`}
              data-testid={DEP_GRAPH.toggleList}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="text-surface-500 hover:text-brand-500 hover:bg-brand-500/5 rounded-lg p-1.5 transition-all"
            title="Add dependency"
            data-testid={DEP_GRAPH.addBtn}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!hasDeps ? (
        <div className="flex flex-col items-center py-6 text-center" data-testid={DEP_GRAPH.emptyState}>
          <GitBranch className="text-surface-400 mb-2 h-8 w-8" />
          <p className="text-surface-500 text-xs font-medium">No dependencies</p>
          <p className="text-surface-500 mt-0.5 text-[10px]">
            Link this task to others
          </p>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="text-brand-500 hover:text-brand-400 mt-2 flex items-center gap-1 text-xs font-medium transition-colors"
            data-testid={DEP_GRAPH.addFromEmpty}
          >
            <Plus className="h-3 w-3" />
            Add dependency
          </button>
        </div>
      ) : viewMode === 'graph' ? (
        <GraphView
          blockedBy={blockedBy}
          blocking={blocking}
          taskId={taskId}
          hoveredPath={hoveredPath}
          setHoveredPath={setHoveredPath}
          onRemove={handleRemove}
          removingId={removingId}
        />
      ) : (
        <ListView
          blockedBy={blockedBy}
          blocking={blocking}
          onRemove={handleRemove}
          removingId={removingId}
        />
      )}

      {/* ── Add Dependency Dialog ─────────────────────── */}
      <AddDependencyDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        taskId={taskId}
        currentDepIds={[
          ...blockedBy.map((d) => d.dependsOnTaskId),
          ...blocking.map((d) => d.taskId),
        ]}
        onAdded={onDependencyAdded}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GRAPH VIEW
// ═══════════════════════════════════════════════════════════════

function GraphView({
  blockedBy,
  blocking,
  taskId,
  hoveredPath,
  setHoveredPath,
  onRemove,
  removingId,
}: {
  blockedBy: Dependency[];
  blocking: Dependency[];
  taskId: string;
  hoveredPath: string | null;
  setHoveredPath: (id: string | null) => void;
  onRemove: (id: string) => Promise<void>;
  removingId: string | null;
}) {
  // Current task info
  const [currentTaskInfo, setCurrentTaskInfo] = useState<{ title: string; taskIdDisplay: string; status: string } | null>(null);

  useEffect(() => {
    async function fetchCurrent() {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentTaskInfo(data.task ?? null);
        }
      } catch {
        // Silent
      }
    }
    if (!currentTaskInfo) fetchCurrent();
  }, [taskId, currentTaskInfo]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-surface-300/20 bg-surface-100/30 p-3" data-testid={DEP_GRAPH.graphView}>
      {/* Upstream (blocked by) */}
      {blockedBy.length > 0 && (
        <div className="mb-2" data-testid={DEP_GRAPH.blockedBy}>
          <p className="text-surface-500 mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
            Blocked by
          </p>
          <div className="space-y-1.5">
            {blockedBy.map((dep) => (
              <motion.div
                key={dep.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onMouseEnter={() => setHoveredPath(dep.id)}
                onMouseLeave={() => setHoveredPath(null)}
                className={cn(
                  'group relative flex items-center gap-2 rounded-lg border-l-4 p-2 transition-all duration-200',
                  statusColors[dep.dependsOnTask?.status ?? 'todo'] ?? statusColors.todo,
                  hoveredPath === dep.id ? 'shadow-md scale-[1.02]' : 'shadow-sm',
                )}
                data-testid={DEP_GRAPH.item(dep.id)}
              >
                <Link
                  href={`/tasks/${dep.dependsOnTaskId}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <ArrowRight className="text-surface-400 h-3 w-3 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-surface-700 truncate text-xs font-medium leading-tight">
                      {dep.dependsOnTask?.title ?? 'Unknown task'}
                    </p>
                    <span className="text-surface-500 text-[10px]">
                      {dep.dependsOnTask?.taskIdDisplay ?? ''}
                    </span>
                  </div>
                  {dep.dependsOnTask?.status && (
                    <Badge
                      variant="default"
                      size="sm"
                      className={`shrink-0 text-[9px] ${
                        statusBadgeColors[dep.dependsOnTask.status] ?? 'bg-surface-200 text-surface-500'
                      }`}
                    >
                      {statusLabels[dep.dependsOnTask.status] ?? dep.dependsOnTask.status}
                    </Badge>
                  )}
                </Link>

                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(dep.id); }}
                  disabled={removingId === dep.id}
                  className="text-surface-400 hover:text-error hover:bg-error/5 rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
                  data-testid={DEP_GRAPH.remove(dep.id)}
                >
                  {removingId === dep.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>

                {/* Hover glow */}
                {hoveredPath === dep.id && (
                  <motion.div
                    layoutId="depGlow"
                    className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-brand-500/5 to-transparent"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Current task (center node) */}
      <motion.div
        layout
        className={cn(
          'border-l-4 rounded-lg border p-2.5 shadow-sm',
          statusColors[currentTaskInfo?.status ?? 'todo'] ?? statusColors.todo,
          'bg-surface-50/80 dark:bg-surface-800/80 border border-surface-300/20',
        )}
        data-testid={DEP_GRAPH.currentTask}
      >
        <div className="flex items-center gap-2">
          <div className="bg-brand-500/10 text-brand-500 flex h-6 w-6 items-center justify-center rounded-md">
            <GitBranch className="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-surface-900 truncate text-sm font-medium">
              {currentTaskInfo?.title ?? 'Current Task'}
            </p>
            {currentTaskInfo?.taskIdDisplay && (
              <span className="text-surface-500 text-[10px]">{currentTaskInfo.taskIdDisplay}</span>
            )}
          </div>
          <Link
            href={`/tasks/${taskId}`}
            className="text-surface-400 hover:text-surface-600 rounded p-1 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </motion.div>

      {/* Downstream (blocking) */}
      {blocking.length > 0 && (
        <div className="mt-2" data-testid={DEP_GRAPH.blocking}>
          <p className="text-surface-500 mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
            Blocking
          </p>
          <div className="space-y-1.5">
            {blocking.map((dep) => (
              <motion.div
                key={dep.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onMouseEnter={() => setHoveredPath(dep.id)}
                onMouseLeave={() => setHoveredPath(null)}
                className={cn(
                  'group relative flex items-center gap-2 rounded-lg border-l-4 p-2 transition-all duration-200',
                  statusColors[dep.blockingTask?.status ?? 'todo'] ?? statusColors.todo,
                  hoveredPath === dep.id ? 'shadow-md scale-[1.02]' : 'shadow-sm',
                )}
                data-testid={DEP_GRAPH.item(dep.id)}
              >
                <Link
                  href={`/tasks/${dep.taskId}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <ArrowLeft className="text-surface-400 h-3 w-3 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-surface-700 truncate text-xs font-medium leading-tight">
                      {dep.blockingTask?.title ?? 'Unknown task'}
                    </p>
                    <span className="text-surface-500 text-[10px]">
                      {dep.blockingTask?.taskIdDisplay ?? ''}
                    </span>
                  </div>
                  {dep.blockingTask?.status && (
                    <Badge
                      variant="default"
                      size="sm"
                      className={`shrink-0 text-[9px] ${
                        statusBadgeColors[dep.blockingTask.status] ?? 'bg-surface-200 text-surface-500'
                      }`}
                    >
                      {statusLabels[dep.blockingTask.status] ?? dep.blockingTask.status}
                    </Badge>
                  )}
                </Link>

                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(dep.id); }}
                  disabled={removingId === dep.id}
                  className="text-surface-400 hover:text-error hover:bg-error/5 rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
                  data-testid={DEP_GRAPH.remove(dep.id)}
                >
                  {removingId === dep.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>

                {/* Hover glow */}
                {hoveredPath === dep.id && (
                  <motion.div
                    layoutId="depGlow"
                    className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-brand-500/5 to-transparent"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LIST VIEW
// ═══════════════════════════════════════════════════════════════

function ListView({
  blockedBy,
  blocking,
  onRemove,
  removingId,
}: {
  blockedBy: Dependency[];
  blocking: Dependency[];
  onRemove: (id: string) => Promise<void>;
  removingId: string | null;
}) {
  return (
    <div className="space-y-2" data-testid={DEP_GRAPH.listView}>
      {blockedBy.length > 0 && (
        <div data-testid={DEP_GRAPH.listBlockedBy}>
          <p className="text-surface-500 mb-1 text-[10px] font-semibold uppercase tracking-wider">
            Blocked by ({blockedBy.length})
          </p>
          <div className="space-y-0.5">
            {blockedBy.map((dep) => (
              <div
                key={dep.id}
                className="group border-surface-300/20 hover:bg-surface-100/80 flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
                data-testid={DEP_GRAPH.item(dep.id)}
              >
                <div className="bg-amber-500/20 flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  <ArrowRight className="text-amber-500 h-3 w-3" />
                </div>
                <Link
                  href={`/tasks/${dep.dependsOnTaskId}`}
                  className="min-w-0 flex-1"
                >
                  <p className="text-surface-700 truncate text-xs font-medium">
                    {dep.dependsOnTask?.title ?? 'Unknown task'}
                  </p>
                  <span className="text-surface-500 text-[10px]">
                    {dep.dependsOnTask?.taskIdDisplay ?? ''}
                  </span>
                </Link>
                <button
                  onClick={() => onRemove(dep.id)}
                  disabled={removingId === dep.id}
                  className="text-surface-400 hover:text-error rounded p-1 opacity-0 transition-all group-hover:opacity-100"
                  data-testid={DEP_GRAPH.remove(dep.id)}
                >
                  {removingId === dep.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {blocking.length > 0 && (
        <div data-testid={DEP_GRAPH.listBlocking}>
          <p className="text-surface-500 mb-1 text-[10px] font-semibold uppercase tracking-wider">
            Blocking ({blocking.length})
          </p>
          <div className="space-y-0.5">
            {blocking.map((dep) => (
              <div
                key={dep.id}
                className="group border-surface-300/20 hover:bg-surface-100/80 flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
                data-testid={DEP_GRAPH.item(dep.id)}
              >
                <div className="bg-red-500/20 flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  <ArrowLeft className="text-red-500 h-3 w-3" />
                </div>
                <Link
                  href={`/tasks/${dep.taskId}`}
                  className="min-w-0 flex-1"
                >
                  <p className="text-surface-700 truncate text-xs font-medium">
                    {dep.blockingTask?.title ?? 'Unknown task'}
                  </p>
                  <span className="text-surface-500 text-[10px]">
                    {dep.blockingTask?.taskIdDisplay ?? ''}
                  </span>
                </Link>
                <button
                  onClick={() => onRemove(dep.id)}
                  disabled={removingId === dep.id}
                  className="text-surface-400 hover:text-error rounded p-1 opacity-0 transition-all group-hover:opacity-100"
                  data-testid={DEP_GRAPH.remove(dep.id)}
                >
                  {removingId === dep.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ADD DEPENDENCY DIALOG
// ═══════════════════════════════════════════════════════════════

function AddDependencyDialog({
  open,
  onOpenChange,
  taskId,
  currentDepIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId: string;
  currentDepIds: string[];
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    { id: string; title: string; taskIdDisplay: string; status: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tasks?search=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          // Filter out current task and already-depended tasks
          setResults(
            (data.tasks ?? []).filter(
              (t: { id: string }) => t.id !== taskId && !currentDepIds.includes(t.id),
            ),
          );
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, taskId, currentDepIds]);

  const addDependency = async (dependsOnTaskId: string) => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependsOnTaskId,
          dependencyType: 'blocks',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to add dependency');
      }
      setQuery('');
      setResults([]);
      onOpenChange(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dependency');
    } finally {
      setAdding(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[15vh]"
          onClick={() => onOpenChange(false)}
          data-testid={DEP_GRAPH.addDialog}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            className="border-surface-300/30 bg-surface-50/95 w-full max-w-lg rounded-2xl border p-4 shadow-lg backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mb-3">
              <Search className="text-surface-400 absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks to link..."
                autoFocus
                className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border py-3 pl-10 pr-4 text-sm transition-all focus:outline-none focus:ring-2"
                data-testid={DEP_GRAPH.searchInput}
              />
              {loading && (
                <Loader2 className="text-surface-400 absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto" data-testid={DEP_GRAPH.searchResults}>
              {results.length === 0 && query.trim() && !loading ? (
                <p className="text-surface-500 py-8 text-center text-sm">
                  No tasks found for &ldquo;{query}&rdquo;
                </p>
              ) : results.length === 0 && !query ? (
                <p className="text-surface-500 py-8 text-center text-sm">
                  Type to search for a task to link
                </p>
              ) : (
                results.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => addDependency(task.id)}
                    disabled={adding}
                    className="hover:bg-surface-200/50 text-surface-700 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors"
                    data-testid={DEP_GRAPH.searchResult(task.id)}
                  >
                    <div className="bg-brand-500/10 text-brand-500 flex h-8 w-8 items-center justify-center rounded-lg">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="text-surface-500 text-xs">{task.taskIdDisplay}</p>
                    </div>
                    <Badge
                      variant="default"
                      size="sm"
                      className={`shrink-0 ${
                        statusBadgeColors[task.status] ?? 'bg-surface-200 text-surface-500'
                      }`}
                    >
                      {statusLabels[task.status] ?? task.status}
                    </Badge>
                  </button>
                ))
              )}
            </div>

            {error && (
              <div className="bg-error/5 text-error mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm" data-testid={DEP_GRAPH.addError}>
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="border-surface-300/20 mt-3 flex items-center justify-between border-t pt-3">
              <p className="text-surface-500 text-xs">
                {adding ? 'Adding...' : 'Select a task to create a dependency'}
              </p>
              <button
                onClick={() => onOpenChange(false)}
                className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                data-testid={DEP_GRAPH.dialogCancel}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
