'use client';

import { useEffect, useState, useCallback, startTransition, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  LayoutList,
  Columns3,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Download,
  CheckCheck,
  X,
  Eye,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { EmptyState } from '@/components/ui/state-display';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskIdDisplay: string;
  assignedTo: string | null;
  projectId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  updatedByName: string | null;
};

type User = { id: string; name: string | null; email: string };

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', open: 'primary', in_progress: 'warning', blocked: 'danger',
  under_review: 'info', on_hold: 'warning', completed: 'success', closed: 'primary',
  reopened: 'warning', cancelled: 'default', archived: 'default',
};

const priorityBadge: Record<string, { label: string; color: string }> = {
  none: { label: 'None', color: 'bg-surface-200/70 text-surface-500 dark:bg-surface-700/50 dark:text-surface-400' },
  low: { label: 'Low', color: 'bg-green-500/10 text-green-400 dark:bg-green-500/15 dark:text-green-300' },
  medium: { label: 'Medium', color: 'bg-amber-500/10 text-amber-400 dark:bg-amber-500/15 dark:text-amber-300' },
  high: { label: 'High', color: 'bg-orange-500/10 text-orange-400 dark:bg-orange-500/15 dark:text-orange-300' },
  urgent: { label: 'Urgent', color: 'bg-red-500/10 text-red-400 dark:bg-red-500/15 dark:text-red-300' },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-300 dark:bg-red-500/25 dark:text-red-200' },
};

const statuses = ['draft', 'open', 'in_progress', 'blocked', 'under_review', 'on_hold', 'completed', 'closed', 'cancelled'];

type ViewMode = 'list' | 'board';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [deletedByFilter, setDeletedByFilter] = useState('');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const pageSize = 25;

  const { toast } = useToast();

  // Trash view
  const [showTrash, setShowTrash] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'status' | 'priority' | 'assign' | 'delete' | null>(null);
  const [batchValue, setBatchValue] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [showBatchPermaDeleteConfirm, setShowBatchPermaDeleteConfirm] = useState(false);
  const [showBatchRestoreConfirm, setShowBatchRestoreConfirm] = useState(false);

  // Cross-page selection
  const [totalCount, setTotalCount] = useState(0);
  const [allSelectedMode, setAllSelectedMode] = useState(false);
  const [allMatchingIds, setAllMatchingIds] = useState<string[]>([]);
  const [fetchingAllIds, setFetchingAllIds] = useState(false);

  // Users for bulk assign
  const [users, setUsers] = useState<User[]>([]);

  // Export
  const [exporting, setExporting] = useState(false);

  const requestIdRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: view === 'board' ? '100' : String(pageSize),
        offset: String(view === 'board' ? 0 : page * pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search) params.set('search', search);
      if (watchedOnly) params.set('watchedBy', 'me');
      if (showTrash) params.set('deleted', 'true');
      if (deletedByFilter) params.set('deletedBy', deletedByFilter);

      const res = await fetch(`/api/tasks?${params}`);
      if (id !== requestIdRef.current) return; // stale — discard
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      if (id !== requestIdRef.current) return;
      setTasks(data.tasks ?? []);
      setTotalCount(data.total ?? 0);
      // Exit cross-page selection mode when data refreshes (filters/pagination may have changed)
      setAllSelectedMode(false);
      setAllMatchingIds([]);
    } catch (err) {
      if (id === requestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      }
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [statusFilter, priorityFilter, deletedByFilter, page, search, view, watchedOnly, showTrash]);

  useEffect(() => { startTransition(() => { fetchTasks(); }); }, [fetchTasks]);

  // Fetch users for batch assign
  useEffect(() => {
    fetch('/api/users?limit=100')
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Permanent delete handler ──────────────────────────────

  const handlePermanentDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/permanent`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to permanently delete task');
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setDeletingTask(null);
      toast({ title: 'Task permanently deleted', description: 'The task has been permanently removed from the database.' });
    } catch (err) {
      console.error('Permanent delete failed:', err);
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' });
      fetchTasks();
    } finally {
      setDeletingId(null);
    }
  };

  // ── Restore handler ──────────────────────────────────────

  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to restore task');
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({ title: 'Task restored', description: 'The task has been restored successfully.' });
    } catch (err) {
      console.error('Restore failed:', err);
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' });
      fetchTasks();
    } finally {
      setRestoringId(null);
    }
  };

  const handleStatusFilter = useCallback((val: string) => { setStatusFilter(val); setPage(0); }, []);
  const handlePriorityFilter = useCallback((val: string) => { setPriorityFilter(val); setPage(0); }, []);
  const handleDeletedByFilter = useCallback((val: string) => { setDeletedByFilter(val); setPage(0); }, []);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to update task');
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    } catch (err) {
      console.error('Status update failed:', err);
      fetchTasks();
    }
  }, [fetchTasks]);

  // ── Selection handlers ─────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length || allSelectedMode) {
      setSelectedIds(new Set());
      setAllSelectedMode(false);
      setAllMatchingIds([]);
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const handleSelectAllAcrossPages = useCallback(async () => {
    if (fetchingAllIds) return;
    setFetchingAllIds(true);
    try {
      const params = new URLSearchParams({
        fields: 'id',
        limit: '100',
      });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search) params.set('search', search);
      if (watchedOnly) params.set('watchedBy', 'me');
      if (showTrash) params.set('deleted', 'true');
      if (deletedByFilter) params.set('deletedBy', deletedByFilter);

      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error('Failed to fetch task IDs');
      const data = await res.json();
      const ids: string[] = data.ids ?? [];

      if (ids.length > 100) {
        toast({ title: 'Too many tasks', description: 'A maximum of 100 tasks can be processed at once. The first 100 will be selected.', variant: 'warning' });
        ids.splice(100);
      }

      setAllMatchingIds(ids);
      setSelectedIds(new Set(ids));
      setAllSelectedMode(true);
    } catch (err) {
      console.error('Failed to fetch all task IDs:', err);
      toast({ title: 'Failed to select all tasks', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' });
    } finally {
      setFetchingAllIds(false);
    }
  }, [statusFilter, priorityFilter, deletedByFilter, search, watchedOnly, showTrash, fetchingAllIds, toast]);

  // ── Batch operations ──────────────────────────────────────

  const getEffectiveIds = () => allSelectedMode && allMatchingIds.length > 0 ? allMatchingIds : Array.from(selectedIds);

  const executeBatch = async () => {
    if (!batchAction || !batchValue || selectedIds.size === 0) return;

    const effectiveIds = getEffectiveIds();
    if (effectiveIds.length === 0) return;

    setBatchProcessing(true);
    try {
      const res = await fetch('/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: effectiveIds,
          action: batchAction,
          value: batchValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Batch operation failed');
      }

      const actionLabels: Record<string, string> = { change_status: 'status changed', change_priority: 'priority changed', assign: 'assigned', delete: 'deleted' };
      const actionLabel = actionLabels[batchAction ?? ''] ?? 'updated';
      toast({ title: `${effectiveIds.length} task${effectiveIds.length !== 1 ? 's' : ''} ${actionLabel}`, description: `Batch operation completed successfully.` });
      setSelectedIds(new Set());
      setBatchAction(null);
      setBatchValue('');
      fetchTasks();
    } catch (err) {
      console.error('Batch operation failed:', err);
      toast({ title: 'Batch operation failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' });
    } finally {
      setBatchProcessing(false);
    }
  };

  const cancelBatch = () => {
    setBatchAction(null);
    setBatchValue('');
  };

  // ── Batch restore handler ─────────────────────────────────

  const handleBatchRestore = async () => {
    const effectiveIds = getEffectiveIds();
    if (effectiveIds.length === 0) return;

    setBatchProcessing(true);
    try {
      const res = await fetch('/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: effectiveIds,
          action: 'restore',
          value: 'restore',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Batch restore failed');
      }

      toast({ title: `${effectiveIds.length} task${effectiveIds.length !== 1 ? 's' : ''} restored`, description: 'The selected tasks have been restored successfully.' });
      setSelectedIds(new Set());
      setAllSelectedMode(false);
      setAllMatchingIds([]);
      fetchTasks();
    } catch (err) {
      console.error('Batch restore failed:', err);
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' });
    } finally {
      setBatchProcessing(false);
    }
  };

  // ── Batch permanent delete handler ────────────────────────

  const handleBatchPermanentDelete = async () => {
    const effectiveIds = getEffectiveIds();
    if (effectiveIds.length === 0) return;
    setShowBatchPermaDeleteConfirm(false);

    setBatchProcessing(true);
    try {
      const res = await fetch('/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: effectiveIds,
          action: 'permanent_delete',
          value: 'permanent_delete',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Batch permanent delete failed');
      }

      toast({ title: `${effectiveIds.length} task${effectiveIds.length !== 1 ? 's' : ''} permanently deleted`, description: 'The selected tasks have been permanently removed from the database.' });
      setSelectedIds(new Set());
      setAllSelectedMode(false);
      setAllMatchingIds([]);
      fetchTasks();
    } catch (err) {
      console.error('Batch permanent delete failed:', err);
      toast({ title: 'Permanent delete failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' });
    } finally {
      setBatchProcessing(false);
    }
  };

  // ── Export ────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ type: 'tasks' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const showPagination = view === 'list' && !loading && !error && tasks.length > 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">Tasks</h1>
          <p className="text-sm text-surface-500 mt-1">
            {loading ? 'Loading...' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || exporting} title="Export tasks as CSV">
            <Download className={cn('h-4 w-4 mr-1.5', exporting && 'animate-spin')} />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
          <Link href="/tasks/new">
            <Button className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Toolbar */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            type="text"
            placeholder="Search tasks..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {(statusFilter || priorityFilter || deletedByFilter) && (
            <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-medium text-white">
              {(statusFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (deletedByFilter ? 1 : 0)}
            </span>
          )}
        </Button>

        {/* Watched toggle */}
        <button
          onClick={() => { setShowTrash(false); setWatchedOnly(!watchedOnly); setPage(0); }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200',
            watchedOnly && !showTrash
              ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20'
              : 'text-surface-500 hover:text-surface-600 hover:bg-surface-200/50 dark:text-surface-400 border border-transparent',
          )}
          title={showTrash ? 'Switch to watched tasks' : watchedOnly ? 'Show all tasks' : 'Show watched tasks only'}
        >
          <Eye className={cn('h-3.5 w-3.5', watchedOnly && !showTrash && 'fill-brand-500/20')} />
          Watched
          {watchedOnly && !showTrash && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/15">
              <X className="h-2.5 w-2.5 text-brand-500" onClick={(e) => { e.stopPropagation(); setWatchedOnly(false); setPage(0); }} />
            </span>
          )}
        </button>

        {/* Trash toggle */}
        <button
          onClick={() => { setShowTrash(!showTrash); setWatchedOnly(false); setDeletedByFilter(''); setPage(0); }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200',
            showTrash
              ? 'bg-error/10 text-error border border-error/20'
              : 'text-surface-500 hover:text-surface-600 hover:bg-surface-200/50 dark:text-surface-400 border border-transparent',
          )}
          title={showTrash ? 'Show active tasks' : 'Show recently deleted tasks'}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Trash
          {showTrash && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-error/15">
              <X className="h-2.5 w-2.5 text-error" onClick={(e) => { e.stopPropagation(); setShowTrash(false); setDeletedByFilter(''); setPage(0); }} />
            </span>
          )}
        </button>

        {/* View Toggle */}
        <div className="flex items-center rounded-xl border border-surface-300/20 bg-surface-100/80 p-0.5">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
              view === 'list'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-600 dark:text-surface-400',
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setView('board')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
              view === 'board'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-600 dark:text-surface-400',
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Board
          </button>
        </div>
      </motion.div>

      {/* Filter Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          className="flex flex-wrap gap-4 rounded-2xl border border-surface-300/20 bg-surface-100/80 p-4"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900/80"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityFilter(e.target.value)}
              className="h-9 rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900/80"
            >
              <option value="">All Priorities</option>
              {Object.entries(priorityBadge).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>
          {showTrash && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500">Deleted By</label>
              <select
                value={deletedByFilter}
                onChange={(e) => handleDeletedByFilter(e.target.value)}
                className="h-9 rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900/80"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
            </div>
          )}
        </motion.div>
      )}

      {/* Select All Across Pages Banner */}
      {!allSelectedMode && selectedIds.size === tasks.length && tasks.length > 0 && totalCount > tasks.length && view === 'list' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-brand-500/20 bg-brand-500/5 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              All <span className="font-semibold text-surface-900 dark:text-surface-200">{tasks.length}</span> task{tasks.length !== 1 ? 's' : ''} on this page are selected.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleSelectAllAcrossPages}
                disabled={fetchingAllIds}
                className="h-8 rounded-lg text-xs whitespace-nowrap"
              >
                {fetchingAllIds ? (
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Loading...</span>
                ) : (
                  <span>Select all <span className="font-semibold">{Math.min(totalCount, 100)}</span> task{Math.min(totalCount, 100) !== 1 ? 's' : ''}{totalCount > 100 ? <span className="font-normal"> of {totalCount} </span> : ' '}across all pages</span>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && view === 'list' && (
          showTrash ? (
            <motion.div
              key="trash-bulk"
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-3"
            >
                <span className="text-xs font-medium text-surface-600 dark:text-surface-400 mr-1">
                <span className="font-semibold text-brand-500">{allSelectedMode ? totalCount : selectedIds.size}</span>{allSelectedMode ? ' ' : ' '}selected
                {allSelectedMode && <span className="text-surface-400 font-normal ml-0.5">(across all pages)</span>}
              </span>

              <div className="h-4 w-px bg-surface-300/30 mx-1" />

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => setShowBatchRestoreConfirm(true)}
                  disabled={batchProcessing}
                  className="h-8 rounded-lg text-xs"
                >
                  {batchProcessing ? (
                    <span className="flex items-center gap-1"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Restoring...</span>
                  ) : (
                    <span className="flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Restore selected</span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBatchPermaDeleteConfirm(true)}
                  disabled={batchProcessing}
                  className="h-8 rounded-lg text-xs border-error/30 text-error hover:bg-error/5 hover:text-error"
                  title="Permanently delete selected tasks"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setSelectedIds(new Set()); setAllSelectedMode(false); setAllMatchingIds([]); }} className="h-8 rounded-lg text-xs">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ) : (
          <motion.div
            key="normal-bulk"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-3"
          >
            <span className="text-xs font-medium text-surface-600 dark:text-surface-400 mr-1">
              <span className="font-semibold text-brand-500">{allSelectedMode ? totalCount : selectedIds.size}</span>{allSelectedMode ? ' ' : ' '}selected
              {allSelectedMode && <span className="text-surface-400 font-normal ml-0.5">(across all pages)</span>}
            </span>

            <div className="h-4 w-px bg-surface-300/30 mx-1" />

            {/* Batch Status */}
            <select
              value={batchAction === 'status' ? batchValue : ''}
              onChange={(e) => { setBatchAction('status'); setBatchValue(e.target.value); }}
              className="h-8 rounded-lg border border-surface-300/20 bg-surface-100/80 px-2 text-xs transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none dark:bg-surface-800/80"
            >
              <option value="">Change status...</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            {/* Batch Priority */}
            <select
              value={batchAction === 'priority' ? batchValue : ''}
              onChange={(e) => { setBatchAction('priority'); setBatchValue(e.target.value); }}
              className="h-8 rounded-lg border border-surface-300/20 bg-surface-100/80 px-2 text-xs transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none dark:bg-surface-800/80"
            >
              <option value="">Change priority...</option>
              {Object.entries(priorityBadge).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>

            {/* Batch Assign */}
            <select
              value={batchAction === 'assign' ? batchValue : ''}
              onChange={(e) => { setBatchAction('assign'); setBatchValue(e.target.value); }}
              className="h-8 rounded-lg border border-surface-300/20 bg-surface-100/80 px-2 text-xs transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none dark:bg-surface-800/80"
            >
              <option value="">Assign to...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>

            {/* Apply / Cancel */}
            <div className="flex items-center gap-1.5 ml-1">
              <Button
                size="sm"
                onClick={executeBatch}
                disabled={!batchAction || !batchValue || batchProcessing}
                className="h-8 rounded-lg text-xs"
              >
                {batchProcessing ? (
                  <span className="flex items-center gap-1"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Applying...</span>
                ) : (
                  <span className="flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" /> Apply</span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setSelectedIds(new Set()); setAllSelectedMode(false); setAllMatchingIds([]); cancelBatch(); }} className="h-8 rounded-lg text-xs">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
          ))}
        </AnimatePresence>

      {/* Content */}
      {loading ? (
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-surface-300/20 bg-surface-100/80 p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-4 shimmer rounded" />
                  <div className="h-4 w-16 shimmer rounded-lg" />
                  <div className="h-4 flex-1 shimmer rounded-lg" />
                  <div className="h-7 w-20 shimmer rounded-full" />
                  <div className="h-7 w-16 shimmer rounded-xl" />
                  <div className="h-4 w-24 shimmer rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : error ? (
        <motion.div variants={itemVariants} className="flex flex-col items-center rounded-2xl border border-error/20 bg-error/5 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-error mb-3" />
          <p className="text-sm font-medium text-error">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchTasks} className="mt-3">Try again</Button>
        </motion.div>          ) : showTrash ? (
            <motion.div variants={itemVariants} className="flex flex-col items-center rounded-2xl border border-surface-300/20 bg-surface-100/80 py-16 text-center">
              <Trash2 className="mx-auto h-10 w-10 text-surface-400 mb-3" />
              <p className="text-sm font-medium text-surface-500">Trash is empty</p>
              <p className="text-xs text-surface-500 mt-1">Deleted tasks will appear here</p>
            </motion.div>
          ) : tasks.length === 0 ? (
        search ? (
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 py-16 text-center">
            <Search className="mx-auto h-10 w-10 text-surface-400 mb-3" />
            <p className="text-sm font-medium text-surface-500">No tasks match your search</p>
            <p className="text-xs text-surface-500 mt-1">Try different search terms or filters</p>
            <Button variant="outline" size="sm" onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter(''); setPriorityFilter(''); }} className="mt-3">
              Clear filters
            </Button>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={<ClipboardList className="h-16 w-16 text-surface-300 dark:text-surface-600" />}
              title="No tasks yet"
              message="Create your first task to get started with your project."
              action={
                <Link href="/tasks/new">
                  <Button><Plus className="h-4 w-4 mr-2" />Create Task</Button>
                </Link>
              }
            />
          </motion.div>
        )
      ) : view === 'board' ? (
        <motion.div variants={itemVariants}>
          <KanbanBoard tasks={tasks} onStatusChange={handleStatusChange} />
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="overflow-hidden rounded-2xl border border-surface-300/20 bg-surface-100/80">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-300/20 bg-surface-200/40 dark:bg-surface-800/40">
                    <th className="px-4 py-3.5 w-10">
                      <Checkbox
                        checked={tasks.length > 0 && (selectedIds.size === tasks.length || allSelectedMode)}
                        onCheckedChange={toggleSelectAll}
                        className="h-4 w-4"
                      />
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">ID</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Title</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Status</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Priority</th>
                    {showTrash ? (
                      <>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Deleted By</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Deleted At</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Assignee</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Due Date</th>
                      </>
                    )}
                    <th className="px-4 py-3.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => (
                    <motion.tr
                      key={task.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, type: 'spring', stiffness: 100, damping: 20 }}
                      className={cn(
                        'border-b border-surface-300/10 transition-all duration-150 group',
                        selectedIds.has(task.id)
                          ? 'bg-brand-500/5 dark:bg-brand-500/10'
                          : 'hover:bg-surface-200/30 dark:hover:bg-surface-800/30',
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <Checkbox
                          checked={selectedIds.has(task.id)}
                          onCheckedChange={() => toggleSelect(task.id)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-surface-500">{task.taskIdDisplay}</td>
                      <td className="px-4 py-3.5">
                        <Link href={`/tasks/${task.id}`} className="font-medium text-surface-900 transition-colors hover:text-brand-500 dark:text-surface-100">
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={statusColors[task.status] ?? 'default'} size="sm">
                          {task.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', priorityBadge[task.priority]?.color ?? 'bg-surface-200/70 text-surface-500')}>
                          {priorityBadge[task.priority]?.label ?? task.priority}
                        </span>
                      </td>
                      {showTrash ? (
                        <>
                          <td className="px-4 py-3.5 text-xs text-surface-500">
                            {task.updatedByName ? (
                              <div className="flex items-center gap-1.5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-error/70 to-error text-[9px] font-medium text-white ring-2 ring-surface-200/50 dark:ring-surface-700/50">
                                  {task.updatedByName.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate max-w-[100px]">{task.updatedByName}</span>
                              </div>
                            ) : (
                              <span className="text-surface-400 italic">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-surface-500">
                            {task.deletedAt ? (
                              <span className="flex items-center gap-1">
                                <span>{new Date(task.deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span className="text-surface-400">{new Date(task.deletedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                            ) : (
                              <span className="text-surface-400 italic">N/A</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5 text-xs text-surface-500">
                            {task.assignedTo ? (
                              <div className="flex items-center gap-1.5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[9px] font-medium text-white ring-2 ring-surface-200/50 dark:ring-surface-700/50">
                                  {task.assignedTo.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate max-w-[80px]">{task.assignedTo}</span>
                              </div>
                            ) : (
                              <span className="text-surface-500">—</span>
                            )}
                          </td>
                          <td className={cn(
                            'px-4 py-3.5 text-xs',
                            task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'closed', 'cancelled'].includes(task.status)
                              ? 'text-error font-medium'
                              : 'text-surface-500'
                          )}>
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3.5">
                        {showTrash ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(task.id)}
                              disabled={restoringId === task.id}
                              className="h-8 rounded-lg text-xs"
                              title="Restore this task"
                            >
                              {restoringId === task.id ? (
                                <span className="flex items-center gap-1"><span className="h-3 w-3 animate-spin rounded-full border-2 border-surface-500 border-t-transparent" /></span>
                              ) : (
                                <span className="flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Restore</span>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingTask(task)}
                              className="h-8 rounded-lg text-xs text-error hover:text-error hover:bg-error/5"
                              title="Permanently delete this task"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button className="rounded-lg p-1.5 text-surface-500 opacity-0 transition-all duration-200 hover:bg-surface-200/70 hover:text-surface-600 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Pagination */}
          {showPagination && (
            <motion.div variants={itemVariants} className="flex items-center justify-between">
              <p className="text-sm text-surface-500">
                Page <span className="font-medium text-surface-700 dark:text-surface-300">{page + 1}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={tasks.length < pageSize} onClick={() => setPage(page + 1)}>
                  Next
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={!!deletingTask} onOpenChange={(open) => { if (!open) setDeletingTask(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-error/10">
                <AlertTriangle className="h-4 w-4 text-error" />
              </span>
              Permanently delete task?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action <strong>cannot be undone</strong>. The task
              {deletingTask && (
                <> &ldquo;<span className="font-medium text-surface-700 dark:text-surface-300">{deletingTask.title}</span>&rdquo;</>
              )} and all its comments, attachments, and history will be permanently removed from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingTask(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTask && handlePermanentDelete(deletingTask.id)}
              disabled={deletingId === deletingTask?.id}
              className="rounded-xl"
            >
              {deletingId === deletingTask?.id ? (
                <span className="flex items-center gap-1"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Deleting...</span>
              ) : (
                <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /> Delete permanently</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Restore Confirmation Dialog */}
      <Dialog open={showBatchRestoreConfirm} onOpenChange={(open) => { if (!open) setShowBatchRestoreConfirm(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/10">
                <RotateCcw className="h-4 w-4 text-brand-500" />
              </span>
              Restore {allSelectedMode ? totalCount : selectedIds.size} task{(allSelectedMode ? totalCount : selectedIds.size) !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will restore the selected task{(allSelectedMode ? totalCount : selectedIds.size) !== 1 ? 's' : ''} to their original state. They will reappear in the active tasks list and all associated data (comments, attachments, history) will be restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBatchRestoreConfirm(false)}
              disabled={batchProcessing}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => { setShowBatchRestoreConfirm(false); handleBatchRestore(); }}
              disabled={batchProcessing}
              className="rounded-xl"
            >
              {batchProcessing ? (
                <span className="flex items-center gap-1"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Restoring...</span>
              ) : (
                <span className="flex items-center gap-1"><RotateCcw className="h-4 w-4" /> Restore {allSelectedMode ? totalCount : selectedIds.size} task{(allSelectedMode ? totalCount : selectedIds.size) !== 1 ? 's' : ''}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Permanent Delete Confirmation Dialog */}
      <Dialog open={showBatchPermaDeleteConfirm} onOpenChange={(open) => { if (!open) setShowBatchPermaDeleteConfirm(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-error/10">
                <AlertTriangle className="h-4 w-4 text-error" />
              </span>
              Permanently delete {allSelectedMode ? totalCount : selectedIds.size} task{(allSelectedMode ? totalCount : selectedIds.size) !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action <strong>cannot be undone</strong>. The selected task{(allSelectedMode ? totalCount : selectedIds.size) !== 1 ? 's' : ''} and all associated comments, attachments, and history will be permanently removed from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBatchPermaDeleteConfirm(false)}
              disabled={batchProcessing}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchPermanentDelete}
              disabled={batchProcessing}
              className="rounded-xl"
            >
              {batchProcessing ? (
                <span className="flex items-center gap-1"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Deleting...</span>
              ) : (
                <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /> Delete {allSelectedMode ? totalCount : selectedIds.size} task{(allSelectedMode ? totalCount : selectedIds.size) !== 1 ? 's' : ''} permanently</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
