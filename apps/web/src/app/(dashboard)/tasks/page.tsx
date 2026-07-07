'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Loader2,
  LayoutList,
  Columns3,
  ClipboardList,
} from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { EmptyState } from '@/components/ui/state-display';
import { cn } from '@/lib/utils';

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
};

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  open: 'primary',
  in_progress: 'warning',
  blocked: 'danger',
  under_review: 'info',
  on_hold: 'warning',
  completed: 'success',
  closed: 'primary',
  reopened: 'warning',
  cancelled: 'default',
  archived: 'default',
};

const priorityLabel: Record<string, string> = {
  none: 'None', low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent', critical: 'Critical',
};

type ViewMode = 'list' | 'board';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const pageSize = 25;

  const fetchTasks = useCallback(async () => {
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

      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, page, search, view]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Debounce search input
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Switch to page 0 when toggling filters
  const handleStatusFilter = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(0);
  }, []);

  const handlePriorityFilter = useCallback((val: string) => {
    setPriorityFilter(val);
    setPage(0);
  }, []);

  // ── Handle status change from Kanban ────────────────────
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
      // Optimistic local update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
    } catch (err) {
      // Refetch on failure to restore correct state
      console.error('Status update failed:', err);
      fetchTasks();
    }
  }, [fetchTasks]);

  const statuses = ['draft', 'open', 'in_progress', 'blocked', 'under_review', 'on_hold', 'completed', 'closed', 'cancelled'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Tasks</h1>
          <p className="text-sm text-surface-500 mt-1">
            {view === 'board'
              ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} across all statuses`
              : `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <Button onClick={() => window.location.href = '/tasks/new'}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Toolbar: Search, Filters, View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-md border border-surface-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900 dark:text-surface-100"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-surface-200 bg-white p-0.5 dark:border-surface-700 dark:bg-surface-900">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'list'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
            )}
            aria-label="List view"
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setView('board')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'board'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
            )}
            aria-label="Board view"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Board
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 rounded-lg border border-surface-200 bg-white dark:bg-surface-900">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-surface-300 bg-white px-3 text-sm dark:bg-surface-800 dark:text-surface-100"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityFilter(e.target.value)}
              className="h-9 rounded-md border border-surface-300 bg-white px-3 text-sm dark:bg-surface-800 dark:text-surface-100"
            >
              <option value="">All Priorities</option>
              {Object.entries(priorityLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Content: Loading / Error / Empty / List or Board */}
      {loading ? (
        view === 'list' ? (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        )
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-red-500">{error}</CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        search ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-surface-400">
              No tasks match your search.
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-12 w-12 text-surface-300" />}
            title="No tasks yet"
            message="Create your first task to get started."
            action={
              <Button onClick={() => window.location.href = '/tasks/new'}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            }
          />
        )
      ) : view === 'board' ? (
        /* ──── Kanban Board View ──── */
        <KanbanBoard tasks={tasks} onStatusChange={handleStatusChange} />
      ) : (
        /* ──── List View ──── */
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="px-4 py-3 text-left font-medium text-surface-500">ID</th>
                      <th className="px-4 py-3 text-left font-medium text-surface-500">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-surface-500">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-surface-500">Priority</th>
                      <th className="px-4 py-3 text-left font-medium text-surface-500">Assignee</th>
                      <th className="px-4 py-3 text-left font-medium text-surface-500">Due Date</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr
                        key={task.id}
                        className="border-b border-surface-100 hover:bg-surface-50 transition-colors dark:border-surface-800 dark:hover:bg-surface-800/50"
                      >
                        <td className="px-4 py-3 text-surface-400 font-mono text-xs">{task.taskIdDisplay}</td>
                        <td className="px-4 py-3">
                          <a href={`/tasks/${task.id}`} className="text-surface-900 hover:text-brand-600 font-medium dark:text-surface-100">
                            {task.title}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusColors[task.status] ?? 'default'}>
                            {task.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-surface-500">{priorityLabel[task.priority] ?? task.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-surface-500 text-xs">{task.assignedTo ? task.assignedTo.substring(0, 8) : '—'}</td>
                        <td className="px-4 py-3 text-surface-500 text-xs">
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button className="rounded p-1 text-surface-400 hover:bg-surface-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Page {page + 1} · {tasks.length} tasks
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={tasks.length < pageSize} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
