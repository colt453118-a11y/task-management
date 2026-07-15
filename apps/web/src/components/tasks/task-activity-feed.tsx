'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { History, AlertCircle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  taskId: string;
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: string;
  description: string | null;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null } | null;
}

interface TaskActivityFeedProps {
  taskId: string;
}

// ─── Helpers ────────────────────────────────────────────────

export const fieldLabels: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  assignedTo: 'Assignee',
  title: 'Title',
  description: 'Description',
  dueDate: 'Due Date',
  projectId: 'Project',
};



export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return ((parts[0] ?? '').charAt(0) + (parts[parts.length - 1] ?? '').charAt(0)).toUpperCase();
}

export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────

export function TaskActivityFeed({ taskId }: TaskActivityFeedProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchHistory = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? []);
      }
    } catch {
      setError('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const displayEntries = expanded ? history : history.slice(0, 10);

  // ── Render ──────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-error/10 bg-error/5 px-3 py-2">
        <AlertCircle className="h-4 w-4 text-error shrink-0" />
        <p className="text-xs text-error">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-20 shimmer rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 shimmer rounded-full" />
              <div className="h-3 flex-1 shimmer rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {history.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <History className="h-8 w-8 text-surface-400 mb-2" />
          <p className="text-sm text-surface-500">No activity yet</p>
          <p className="text-xs text-surface-500 mt-0.5">Changes to this task will appear here</p>
        </div>
      ) : (
        <>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-surface-300/30 dark:bg-surface-700/30" />

            <div className="space-y-0">
              <AnimatePresence initial={false}>
                {displayEntries.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="relative flex items-start gap-3 py-1.5 group"
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-0.5">
                      <div className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-medium text-white ring-2 ring-surface-50 dark:ring-surface-900',
                        entry.changeType === 'status_change'
                          ? 'bg-amber-500'
                          : entry.changeType === 'assignment'
                            ? 'bg-blue-500'
                            : entry.changeType === 'creation'
                              ? 'bg-green-500'
                              : 'bg-surface-400',
                      )}>
                        {getInitials(entry.user?.name)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium text-surface-700 dark:text-surface-300 truncate max-w-[100px]">
                          {entry.user?.name ?? 'System'}
                        </span>
                        {entry.description ? (
                          <span className="text-surface-500 truncate">
                            {entry.description}
                          </span>
                        ) : (
                          <span className="text-surface-500">
                            Updated{' '}
                            <span className="font-medium text-surface-600 dark:text-surface-400">
                              {fieldLabels[entry.field] ?? entry.field}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-surface-400 mt-0.5">
                        {formatTimeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Show more / less */}
          {history.length > 10 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 py-2 transition-colors"
            >
              {expanded
                ? `Show less`
                : `Show ${history.length - 10} more entries`
              }
            </button>
          )}
        </>
      )}
    </div>
  );
}
