'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { KanbanCard } from './kanban-card';
import { Plus } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskIdDisplay: string;
  assignedTo: string | null;
  dueDate: string | null;
}

interface KanbanColumnProps {
  status: string;
  label: string;
  tasks: Task[];
  headerBg: string;
  isValidDropTarget?: boolean;
}

const statusDotColors: Record<string, string> = {
  draft: 'bg-status-draft',
  open: 'bg-status-open',
  assigned: 'bg-status-on-hold',
  in_progress: 'bg-status-in-progress',
  blocked: 'bg-status-blocked',
  on_hold: 'bg-status-on-hold',
  under_review: 'bg-status-under-review',
  completed: 'bg-status-completed',
  closed: 'bg-status-closed',
  cancelled: 'bg-status-cancelled',
  archived: 'bg-status-archived',
  reopened: 'bg-status-approved',
};

// ─── Column Colors (for the left accent strip) ────────────────

const statusBorderAccent: Record<string, string> = {
  draft:        'border-l-status-draft',
  open:         'border-l-status-open',
  assigned:     'border-l-status-on-hold',
  in_progress:  'border-l-status-in-progress',
  blocked:      'border-l-status-blocked',
  on_hold:      'border-l-status-on-hold',
  under_review: 'border-l-status-under-review',
  completed:    'border-l-status-completed',
  closed:       'border-l-status-closed',
  cancelled:    'border-l-status-cancelled',
  archived:     'border-l-status-archived',
  reopened:     'border-l-status-approved',
};

export function KanbanColumn({ status, label, tasks, headerBg, isValidDropTarget }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status, accepts: status },
  });

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Column container
        'flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0 rounded-xl transition-all duration-200',
        // Background
        'bg-surface-100/60 dark:bg-surface-800/40',
        // Left accent strip
        'border-l-2',
        statusBorderAccent[status] ?? 'border-l-surface-300',
        // Drop indicator
        isOver && isValidDropTarget !== false && 'ring-2 ring-brand-400 ring-inset bg-brand-50/40 dark:bg-brand-900/20',
        isOver && isValidDropTarget === false && 'ring-2 ring-red-400 ring-inset bg-red-50/40 dark:bg-red-900/20',
      )}
    >
      {/* Column Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-3 border-b border-surface-200/60 dark:border-surface-700/60 rounded-t-xl',
        headerBg,
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', statusDotColors[status] ?? 'bg-surface-400')} />
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 truncate">
            {label}
          </h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-surface-200/70 dark:bg-surface-700/70 px-1.5 text-[11px] font-medium text-surface-500 dark:text-surface-400">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => window.location.href = `/tasks/new?status=${status}`}
          className="rounded-md p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-200/60 dark:hover:bg-surface-700/60 transition-colors"
          aria-label={`Create task in ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Task List — Sortable within the column */}
      <div className="flex flex-col gap-2 p-3 overflow-y-auto min-h-[120px] flex-1">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-surface-400 dark:text-surface-500">
              No tasks
            </p>
            <p className="text-[10px] text-surface-300 dark:text-surface-600 mt-0.5">
              Drag tasks here
            </p>
          </div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <KanbanCard key={task.id} task={task} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
