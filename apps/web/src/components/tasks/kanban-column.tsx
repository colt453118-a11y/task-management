'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { KanbanCard } from './kanban-card';
import { Plus } from 'lucide-react';
import { KANBAN } from '@/lib/test-ids';

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

export function KanbanColumn({
  status,
  label,
  tasks,
  headerBg,
  isValidDropTarget,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status, accepts: status },
  });

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      data-testid={KANBAN.column(status)}
      className={cn(
        // Column container
        'flex min-w-[280px] max-w-[320px] flex-shrink-0 flex-col rounded-xl transition-all duration-300',
        // Background
        'bg-surface-100/60 dark:bg-surface-800/40',
        // Left accent strip
        'border-l-2',
        statusBorderAccent[status] ?? 'border-l-surface-300',
        // Drop indicator - with smooth transitions
        isOver &&
          isValidDropTarget !== false &&
          'ring-brand-400 bg-brand-50/40 dark:bg-brand-900/20 scale-[1.02] ring-2 ring-inset',
        isOver &&
          isValidDropTarget === false &&
          'scale-[1.02] bg-red-50/40 ring-2 ring-inset ring-red-400 dark:bg-red-900/20',
        // Subtle hover lift when not dragging
        'hover:shadow-sm',
      )}
    >
      {/* Column Header */}
      <div
        data-testid={KANBAN.columnHeader(status)}
        className={cn(
          'border-surface-200/60 dark:border-surface-700/60 flex items-center justify-between rounded-t-xl border-b px-3 py-3',
          headerBg,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <motion.span
            animate={isOver ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              statusDotColors[status] ?? 'bg-surface-400',
            )}
          />
          <h3 className="text-surface-700 dark:text-surface-300 truncate text-sm font-semibold">
            {label}
          </h3>
          <motion.span
            key={tasks.length}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-surface-200/70 dark:bg-surface-700/70 text-surface-500 dark:text-surface-400 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums"
          >
            {tasks.length}
          </motion.span>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => (window.location.href = `/tasks/new?status=${status}`)}
          data-testid={KANBAN.columnAddBtn(status)}
          className="text-surface-400 hover:text-surface-600 hover:bg-surface-200/60 dark:hover:bg-surface-700/60 rounded-md p-1 transition-colors"
          aria-label={`Create task in ${label}`}
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Task List — Sortable within the column */}
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <motion.div
            data-testid={KANBAN.columnEmpty(status)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            {isOver && isValidDropTarget !== false ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center"
                data-testid={KANBAN.dropHere}
              >
                <div className="bg-brand-500/10 mb-2 flex h-8 w-8 items-center justify-center rounded-full">
                  <Plus className="text-brand-400 h-4 w-4" />
                </div>
                <p className="text-brand-400 text-xs font-medium">Drop here</p>
              </motion.div>
            ) : (
              <>
                <p className="text-surface-400 dark:text-surface-500 text-xs">No tasks</p>
                <p className="text-surface-300 dark:text-surface-600 mt-0.5 text-[10px]">
                  Drag tasks here
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02, type: 'spring', stiffness: 200, damping: 20 }}
              >
                <KanbanCard task={task} />
              </motion.div>
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
