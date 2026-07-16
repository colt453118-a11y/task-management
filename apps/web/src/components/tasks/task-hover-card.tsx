'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Loader2, Calendar, User, Clock, AlertCircle } from 'lucide-react';
// ─── Task Preview Data ──────────────────────────────────────

interface TaskPreview {
  id: string;
  title: string;
  taskIdDisplay: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
  estimatedHours: string | null;
}

const statusColors: Record<
  string,
  'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
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
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
};

// ─── Hover Card Component ───────────────────────────────────

interface TaskHoverCardProps {
  /** The task ID or taskIdDisplay to look up */
  taskRef: string;
  /** The trigger element (text, badge, etc.) */
  children: ReactNode;
  /** Optional className for the trigger wrapper */
  className?: string;
}

export function TaskHoverCard({ taskRef, children, className }: TaskHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<TaskPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef<string | null>(null);

  const doFetch = async () => {
    if (fetchedRef.current === taskRef) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskRef)}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Task not found');
        throw new Error('Failed to load');
      }
      const data = await res.json();
      setPreview(data.task ?? null);
      fetchedRef.current = taskRef;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setOpen(true);
      doFetch();
    }, 500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            'text-brand-500 hover:text-brand-400 decoration-brand-500/30 hover:decoration-brand-500/60 cursor-pointer underline underline-offset-2 transition-all duration-200',
            className,
          )}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-72 overflow-hidden p-0"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-8"
            >
              <Loader2 className="text-surface-400 h-5 w-5 animate-spin" />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col items-center justify-center px-4 py-6 text-center"
            >
              <AlertCircle className="text-surface-400 mb-2 h-6 w-6" />
              <p className="text-surface-500 text-xs">{error}</p>
            </motion.div>
          )}

          {preview && !loading && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {/* Color bar */}
              <div
                className={cn(
                  'h-1',
                  preview.priority === 'critical' || preview.priority === 'urgent'
                    ? 'bg-red-500'
                    : preview.priority === 'high'
                      ? 'bg-amber-500'
                      : preview.status === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-brand-500',
                )}
              />

              {/* Header */}
              <div className="px-4 pb-2 pt-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-surface-400 font-mono text-[11px]">
                    {preview.taskIdDisplay}
                  </span>
                  <Badge
                    variant={statusColors[preview.status] ?? 'default'}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {preview.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <h4 className="text-surface-900 dark:text-surface-100 line-clamp-2 text-sm font-semibold leading-snug">
                  {preview.title}
                </h4>
              </div>

              {/* Meta */}
              <div className="space-y-1.5 px-4 pb-3">
                <div className="text-surface-500 flex items-center gap-3 text-[11px]">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      preview.priority === 'critical' ||
                        preview.priority === 'urgent' ||
                        preview.priority === 'high'
                        ? 'bg-red-500/10 text-red-400'
                        : preview.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-surface-200/50 text-surface-500 dark:bg-surface-800/50',
                    )}
                  >
                    {priorityLabel[preview.priority] ?? preview.priority}
                  </span>
                  {preview.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(preview.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                {preview.assignedTo && (
                  <div className="text-surface-500 flex items-center gap-1.5 text-[11px]">
                    <User className="h-3 w-3" />
                    <span className="truncate">{preview.assignedTo.substring(0, 16)}...</span>
                  </div>
                )}
                <div className="text-surface-500 flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created{' '}
                    {new Date(preview.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {preview.estimatedHours && <span>{preview.estimatedHours}h estimated</span>}
                </div>
              </div>

              {/* Footer link */}
              <a
                href={`/tasks/${preview.id}`}
                className="border-surface-300/10 dark:border-surface-700/30 text-brand-500 hover:text-brand-400 hover:bg-brand-500/5 block border-t px-4 py-2 text-[11px] font-medium transition-all duration-200"
              >
                Open task &rarr;
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}

// ─── Task Mention Inline Component ──────────────────────────
// Parses task references like #TASK-123 or UUIDs in text

const TASK_REF_PATTERN = /#?([A-Z]+-\d+|[0-9a-fA-F-]{36})/g;

/** Creates a fresh copy of the regex for each invocation to avoid mutating the module-level lastIndex. */
function createTaskRefRegex(): RegExp {
  return new RegExp(TASK_REF_PATTERN.source, 'g');
}

interface TaskMentionTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with task references automatically turned into
 * hoverable TaskHoverCard triggers.
 */
export function TaskMentionText({ text, className }: TaskMentionTextProps) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const re = createTaskRefRegex();
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>);
    }

    const ref = match[0];
    const taskId = ref.startsWith('#') ? ref.slice(1) : ref;

    parts.push(
      <TaskHoverCard key={match.index} taskRef={taskId}>
        {ref}
      </TaskHoverCard>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
  }

  return <span className={className}>{parts.length > 0 ? parts : text}</span>;
}
