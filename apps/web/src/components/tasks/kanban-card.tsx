'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Calendar, User } from 'lucide-react';

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
  none:     { label: 'None',    color: 'bg-priority-none/20 text-priority-none',          dot: 'bg-priority-none' },
  low:      { label: 'Low',     color: 'bg-priority-low/20 text-priority-low',            dot: 'bg-priority-low' },
  medium:   { label: 'Medium',  color: 'bg-priority-medium/20 text-priority-medium',      dot: 'bg-priority-medium' },
  high:     { label: 'High',    color: 'bg-priority-high/20 text-priority-high',          dot: 'bg-priority-high' },
  urgent:   { label: 'Urgent',  color: 'bg-priority-urgent/20 text-priority-urgent',      dot: 'bg-priority-urgent' },
  critical: { label: 'Critical',color: 'bg-priority-critical/20 text-priority-critical',  dot: 'bg-priority-critical' },
};

const READONLY_STATUSES = new Set(['closed', 'archived', 'completed']);

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

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task, status: task.status },
    disabled: isReadonly,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
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
      className={cn(
        // Base card styles
        'group relative rounded-lg border bg-white p-3 transition-all',
        'dark:bg-surface-900 dark:border-surface-700',
        // Hover
        'hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800',
        // Focus
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        // Dragging
        isDragging && 'opacity-30 shadow-none border-dashed',
        isDragOverlay && 'shadow-glass rotate-[3deg] border-brand-300 dark:border-brand-700',
        isReadonly && 'opacity-60',
        // Left border accent by status
        task.status === 'draft' && 'border-l-4 border-l-status-draft',
        task.status === 'open' && 'border-l-4 border-l-status-open',
        task.status === 'assigned' && 'border-l-4 border-l-status-on-hold',
        task.status === 'in_progress' && 'border-l-4 border-l-status-in-progress',
        task.status === 'blocked' && 'border-l-4 border-l-status-blocked',
        task.status === 'under_review' && 'border-l-4 border-l-status-under-review',
        task.status === 'completed' && 'border-l-4 border-l-status-completed',
        task.status === 'closed' && 'border-l-4 border-l-status-closed',
        task.status === 'cancelled' && 'border-l-4 border-l-status-cancelled',
        task.status === 'on_hold' && 'border-l-4 border-l-status-on-hold',
        task.status === 'reopened' && 'border-l-4 border-l-status-approved',
        task.status === 'archived' && 'border-l-4 border-l-status-archived',
      )}
    >
      {/* Task ID + Priority row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-mono font-medium text-surface-400 dark:text-surface-500">
          {task.taskIdDisplay}
        </span>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
          priority.color,
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} />
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-surface-900 dark:text-surface-100 leading-snug line-clamp-2 mb-2">
        {task.title}
      </h4>

      {/* Footer: Assignee + Due Date */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-surface-400 dark:text-surface-500">
        <div className="flex items-center gap-1 min-w-0">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {task.assignedTo ? (
              task.assignedTo.length > 8 ? task.assignedTo.substring(0, 8) + '…' : task.assignedTo
            ) : (
              'Unassigned'
            )}
          </span>
        </div>
        {formattedDate && (
          <div className={cn(
            'flex items-center gap-1 shrink-0',
            isOverdue && 'text-status-blocked font-medium',
          )}>
            <Calendar className="h-3 w-3" />
            <span>{formattedDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
