'use client';

import { useState, useCallback, useEffect, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

import Image from 'next/image';
import {
  Activity,
  MessageSquare,
  ArrowRightLeft,
  UserPlus,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Archive,
  RotateCcw,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

export type ActivityFeedItem = {
  id: string;
  type: 'task_update' | 'comment' | 'audit';
  action: string;
  description: string | null;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  taskId: string | null;
  taskTitle: string | null;
  projectId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

interface TeamActivityFeedProps {
  /** Max items to show (default 20) */
  maxItems?: number;
  /**
   * External refresh trigger — increment this value to force an immediate
   * refetch of the activity feed (e.g. when a new notification arrives via SSE).
   */
  refreshCounter?: number;
}

// ─── Tailwind-safe color maps ───────────────────────────────
// These must be complete class literals so Tailwind's JIT scanner picks them up.

const AVATAR_COLORS: Record<string, string> = {
  comment: 'bg-blue-500',
  'comment.added': 'bg-blue-500',
  create: 'bg-green-500',
  'task.created': 'bg-green-500',
  'project.created': 'bg-green-500',
  status_change: 'bg-amber-500',
  'task.status_changed': 'bg-amber-500',
  assignment: 'bg-purple-500',
  'task.assigned': 'bg-purple-500',
  'task.completed': 'bg-emerald-500',
  'task.closed': 'bg-indigo-500',
  'task.reopened': 'bg-cyan-500',
};

const CHIP_COLORS: Record<string, string> = {
  comment: 'text-blue-500 bg-blue-500/10',
  'comment.added': 'text-blue-500 bg-blue-500/10',
  create: 'text-green-500 bg-green-500/10',
  'task.created': 'text-green-500 bg-green-500/10',
  'project.created': 'text-green-500 bg-green-500/10',
  status_change: 'text-amber-500 bg-amber-500/10',
  'task.status_changed': 'text-amber-500 bg-amber-500/10',
  assignment: 'text-purple-500 bg-purple-500/10',
  'task.assigned': 'text-purple-500 bg-purple-500/10',
  'task.completed': 'text-emerald-500 bg-emerald-500/10',
  'task.closed': 'text-indigo-500 bg-indigo-500/10',
  'task.reopened': 'text-cyan-500 bg-cyan-500/10',
};

function avatarBg(action: string): string {
  return AVATAR_COLORS[action] ?? 'bg-surface-400';
}

function chipColor(action: string): string {
  return CHIP_COLORS[action] ?? 'text-surface-500 bg-surface-200/50';
}

// ─── Helpers ────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return ((parts[0] ?? '').charAt(0) + (parts[parts.length - 1] ?? '').charAt(0)).toUpperCase();
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'update': 'updated',
    'create': 'created',
    'status_change': 'changed status',
    'assignment': 'assigned',
    'comment.added': 'commented on',
    'task.created': 'created task',
    'task.status_changed': 'changed status of',
    'task.assigned': 'assigned',
    'task.completed': 'completed',
    'task.closed': 'closed',
    'task.reopened': 'reopened',
    'project.created': 'created project',
    'user.created': 'invited user',
    'role.created': 'created role',
  };
  return labels[action] ?? action.replace(/_/g, ' ');
}

function getActionIcon(action: string) {
  if (action.startsWith('comment')) return MessageSquare;
  if (action === 'create' || action.startsWith('task.created') || action.startsWith('project.created') || action.startsWith('user.created') || action.startsWith('role.created')) return PlusCircle;
  if (action === 'status_change' || action === 'task.status_changed') return ArrowRightLeft;
  if (action === 'assignment' || action === 'task.assigned') return UserPlus;
  if (action === 'task.completed') return CheckCircle2;
  if (action === 'task.closed') return Archive;
  if (action === 'task.reopened') return RotateCcw;
  return Activity;
}

function formatDescription(
  item: ActivityFeedItem,
): { text: string; taskLink?: string } {
  if (item.type === 'comment') {
    const snippet = item.description
      ? item.description.replace(/<[^>]*>/g, '').slice(0, 80) + (item.description.length > 80 ? '…' : '')
      : '';
    return { text: snippet, taskLink: item.taskId ? `/tasks/${item.taskId}` : undefined };
  }

  if (item.type === 'audit') {
    if (item.action === 'task.created' && item.taskTitle) {
      return { text: `"${item.taskTitle}"`, taskLink: item.taskId ? `/tasks/${item.taskId}` : undefined };
    }
    if (item.action === 'task.completed' && item.taskTitle) {
      return { text: `"${item.taskTitle}"`, taskLink: item.taskId ? `/tasks/${item.taskId}` : undefined };
    }
    if (item.action === 'project.created' && item.metadata?.entityId) {
      return { text: `Project ${item.metadata.entityId}` };
    }
    return { text: item.action.replace(/\./g, ' ') };
  }

  if (item.description) {
    return { text: item.description, taskLink: item.taskId ? `/tasks/${item.taskId}` : undefined };
  }

  if (item.metadata) {
    const field = item.metadata.field as string;
    const newVal = item.metadata.newValue as string;
    if (field === 'status' && newVal) {
      return { text: `→ ${newVal.replace(/_/g, ' ')}`, taskLink: item.taskId ? `/tasks/${item.taskId}` : undefined };
    }
  }

  return {
    text: item.taskTitle ?? 'Unknown task',
    taskLink: item.taskId ? `/tasks/${item.taskId}` : undefined,
  };
}

// ─── Component ───────────────────────────────────────────────

export function TeamActivityFeed({ maxItems = 20, refreshCounter = 0 }: TeamActivityFeedProps) {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const fetchFeed = useCallback(async () => {
    if (paused) return;
    try {
      const res = await fetch('/api/activity-feed');
      if (!res.ok) throw new Error('Failed to fetch activity feed');
      const data = await res.json();
      if (data.items) {
        setItems((prev) => {
          // If we have items, only update if the data actually changed (avoid unnecessary re-renders)
          if (prev.length > 0 && data.items.length > 0) {
            const prevFirst = prev[0]?.id;
            const newFirst = data.items[0]?.id;
            if (prevFirst === newFirst && prev.length === data.items.length) {
              return prev; // No change — skip re-render
            }
          }
          return data.items;
        });
      }
      setError(null);
    } catch (err) {
      if (itemsRef.current.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      }
    } finally {
      setLoading(false);
    }
  }, [paused]);

  // Initial fetch + refetch when refreshCounter changes (SSE-triggered refresh)
  useEffect(() => {
    startTransition(() => {
      fetchFeed();
    });
  }, [fetchFeed, refreshCounter]);

  // Poll every 30s as fallback (SSE updates the feed between polls)
  useEffect(() => {
    pollRef.current = setInterval(fetchFeed, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchFeed]);

  // Pause polling on hover
  const handleMouseEnter = () => setPaused(true);
  const handleMouseLeave = () => setPaused(false);

  // Navigate to task page
  const handleItemClick = useCallback((taskLink?: string) => {
    if (!taskLink) return;
    // Use window.location for server navigation (simpler than useRouter for a widget)
    window.location.href = taskLink;
  }, []);

  // ── Render States ──────────────────────────────────────

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <AlertCircle className="text-error/50 h-10 w-10" />
        <p className="text-surface-500 mt-2 text-sm font-medium">Failed to load activity</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchFeed(); }}
          className="text-brand-400 hover:text-brand-300 mt-2 flex items-center gap-1 text-xs transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="shimmer h-4 w-24 rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="shimmer h-3 w-3/4 rounded-lg" />
              <div className="shimmer h-2 w-1/4 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const displayItems = items.slice(0, maxItems);

  return (
    <div ref={containerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Activity className="text-surface-300 dark:text-surface-600 mb-3 h-10 w-10" />
          <p className="text-surface-500 text-sm font-medium">No activity yet</p>
          <p className="text-surface-400 mt-1 text-xs">
            Changes across the organization will appear here
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="bg-surface-300/30 dark:bg-surface-700/30 absolute bottom-3 left-[17px] top-3 w-px" />

          <div className="space-y-0">
            <AnimatePresence initial={false}>
              {displayItems.map((item, idx) => {
                const ActionIcon = getActionIcon(item.action);
                const bgColor = avatarBg(item.action);
                const chip = chipColor(item.action);
                const desc = formatDescription(item);

                return (
                  <motion.div
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.3 }}
                    onClick={() => handleItemClick(desc.taskLink)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleItemClick(desc.taskLink);
                      }
                    }}
                    role={desc.taskLink ? 'button' : undefined}
                    tabIndex={desc.taskLink ? 0 : undefined}
                    className={cn(
                      'group relative flex items-start gap-3 px-1 py-2.5 transition-all duration-200',
                      'hover:bg-surface-200/40 dark:hover:bg-surface-800/40 rounded-xl',
                      desc.taskLink && 'cursor-pointer',
                    )}
                  >
                    {/* User avatar */}
                    <div className="relative z-10 mt-0.5">
                      {item.userAvatar ? (
                        <Image
                          src={item.userAvatar}
                          alt={item.userName ?? 'User'}
                          width={32}
                          height={32}
                          unoptimized
                          className="h-8 w-8 rounded-full object-cover ring-2 ring-surface-50 dark:ring-surface-900"
                        />
                      ) : (
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-surface-50 dark:ring-surface-900',
                            bgColor,
                          )}
                          title={item.userName ?? 'Unknown user'}
                        >
                          {getInitials(item.userName)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-xs sm:text-sm">
                        <span className="text-surface-700 dark:text-surface-300 max-w-[120px] truncate font-semibold sm:max-w-[160px]">
                          {item.userName ?? 'System'}
                        </span>
                        <span className="text-surface-500 shrink-0">
                          {getActionLabel(item.action)}
                        </span>
                        {desc.taskLink ? (
                          <span className="text-brand-400 max-w-[200px] truncate font-medium sm:max-w-[280px]">
                            {desc.text}
                            <ExternalLink className="text-brand-400/50 ml-0.5 inline-block h-2.5 w-2.5" />
                          </span>
                        ) : (
                          <span className="text-surface-600 dark:text-surface-400 max-w-[200px] truncate sm:max-w-[280px]">
                            {desc.text}
                          </span>
                        )}
                      </div>

                      {/* Action chip + timestamp row */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                          chip,
                        )}>
                          <ActionIcon className="h-2.5 w-2.5" />
                          <span>{item.type === 'comment' ? 'Comment' : item.action.split('.')[0] ?? item.type}</span>
                        </span>
                        <span className="text-surface-400 text-[10px] font-medium tabular-nums">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                        {item.taskTitle && (
                          <>
                            <span className="text-surface-300 dark:text-surface-600">·</span>
                            <span className="text-surface-400 max-w-[120px] truncate text-[10px] sm:max-w-[180px]">
                              {item.taskTitle}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Footer: live indicator + refresh */}
      <div className="mt-3 flex items-center justify-between border-t border-surface-300/20 pt-2">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            error ? 'bg-error/50' : paused ? 'bg-amber-400' : 'bg-green-500',
          )} />
          <span className="text-surface-400 text-[10px]">
            {error ? 'Connection issue' : paused ? 'Paused' : 'Live'}
          </span>
        </div>
        <button
          onClick={() => { fetchFeed(); }}
          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex items-center gap-1 text-[10px] transition-colors"
          title="Refresh now"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}
