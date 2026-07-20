'use client';

import { useSortable } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Calendar, User, GripVertical } from 'lucide-react';
import { KANBAN } from '@/lib/test-ids';

interface KanbanCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    taskIdDisplay: string;
    assignedTo: string | null;
    dueDate: string | null;
  };
  isDragOverlay?: boolean;
}

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  none: { label: 'None', color: 'bg-priority-none/20 text-priority-none', dot: 'bg-priority-none' },
  low: { label: 'Low', color: 'bg-priority-low/20 text-priority-low', dot: 'bg-priority-low' },
  medium: {
    label: 'Medium',
    color: 'bg-priority-medium/20 text-priority-medium',
    dot: 'bg-priority-medium',
  },
  high: { label: 'High', color: 'bg-priority-high/20 text-priority-high', dot: 'bg-priority-high' },
  urgent: {
    label: 'Urgent',
    color: 'bg-priority-urgent/20 text-priority-urgent',
    dot: 'bg-priority-urgent',
  },
  critical: {
    label: 'Critical',
    color: 'bg-priority-critical/20 text-priority-critical',
    dot: 'bg-priority-critical',
  },
};

const READONLY_STATUSES = new Set(['closed', 'archived', 'completed']);

const statusBorderAccent: Record<string, string> = {
  draft: 'border-l-status-draft',
  open: 'border-l-status-open',
  assigned: 'border-l-status-on-hold',
  in_progress: 'border-l-status-in-progress',
  blocked: 'border-l-status-blocked',
  on_hold: 'border-l-status-on-hold',
  under_review: 'border-l-status-under-review',
  completed: 'border-l-status-completed',
  closed: 'border-l-status-closed',
  cancelled: 'border-l-status-cancelled',
  archived: 'border-l-status-archived',
  reopened: 'border-l-status-approved',
};

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

export function KanbanCard({ task, isDragOverlay = false }: KanbanCardProps) {
  const isReadonly = READONLY_STATUSES.has(task.status);
  const priority = priorityConfig[task.priority] ?? priorityConfig.none!;
  const formattedDate = formatDate(task.dueDate);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isReadonly;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task, status: task.status },
    disabled: isReadonly,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Task ${task.taskIdDisplay}: ${task.title}`}
      data-testid={KANBAN.card(task.id)}
      className={cn(
        // Base card styles
        'group relative rounded-lg border bg-white p-3 transition-all duration-200',
        'dark:bg-surface-900 dark:border-surface-700',
        // Hover
        'hover:border-brand-200 dark:hover:border-brand-800 hover:-translate-y-0.5 hover:shadow-md',
        // Focus
        'focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2',
        // Dragging
        isDragging && 'scale-95 border-dashed opacity-30 shadow-none',
        isDragOverlay &&
          'shadow-glass border-brand-300 dark:border-brand-700 rotate-[3deg] scale-105',
        isReadonly && 'opacity-60',
        // Left border accent by status
        'border-l-4',
        statusBorderAccent[task.status] ?? 'border-l-surface-300',
      )}
    >
      {/* Drag handle indicator - shows on hover */}
      {!isReadonly && !isDragOverlay && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <GripVertical className="text-surface-400 h-3.5 w-3.5" />
        </div>
      )}

      {/* Task ID + Priority row */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-surface-400 dark:text-surface-500 font-mono text-[11px] font-medium">
          {task.taskIdDisplay}
        </span>
        <motion.span
          whileHover={{ scale: 1.05 }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            priority.color,
          )}
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={cn('h-1.5 w-1.5 rounded-full', priority.dot)}
          />
          {priority.label}
        </motion.span>
      </div>

      {/* Title */}
      <h4
        data-testid={KANBAN.cardTitle(task.id)}
        className="text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 mb-2 line-clamp-2 text-sm font-medium leading-snug transition-colors duration-200"
      >
        {task.title}
      </h4>

      {/* Footer: Assignee + Due Date */}
      <div className="text-surface-400 dark:text-surface-500 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-1">
          <User className="h-3 w-3 shrink-0 transition-transform group-hover:scale-110" />
          <span className="truncate">
            {task.assignedTo
              ? task.assignedTo.length > 8
                ? task.assignedTo.substring(0, 8) + '…'
                : task.assignedTo
              : 'Unassigned'}
          </span>
        </div>
        {formattedDate && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={cn(
              'flex shrink-0 items-center gap-1',
              isOverdue && 'text-status-blocked font-medium',
            )}
          >
            <Calendar className="h-3 w-3" />
            <span>{formattedDate}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
