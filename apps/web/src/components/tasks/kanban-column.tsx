'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { KanbanCard } from './kanban-card';
import { Plus, ChevronDown, AlertTriangle, ArrowUpDown } from 'lucide-react';
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

interface SwimlaneGroup {
  id: string;
  label: string;
  count: number;
  tasks: Task[];
}

interface KanbanColumnProps {
  status: string;
  label: string;
  lanes: SwimlaneGroup[];
  headerBg: string;
  isValidDropTarget?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  swimlaneMode?: 'none' | 'assignee' | 'priority';
  wipLimit?: { limit: number; warningThreshold: number };
  wipCount?: number;
  isAtWipLimit?: boolean;
  onCardTap?: (task: Task) => void;
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
  lanes,
  headerBg,
  isValidDropTarget,
  collapsed = false,
  onToggleCollapse,
  swimlaneMode = 'none',
  wipLimit,
  wipCount,
  onCardTap,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status, accepts: status },
  });

  const allTaskIds = useMemo(() => lanes.flatMap((g) => g.tasks.map((t) => t.id)), [lanes]);

  // WIP limit state
  const isOverWipLimit = wipLimit && wipCount !== undefined && wipCount >= wipLimit.limit;
  const isNearWipLimit = wipLimit && wipCount !== undefined && wipCount >= wipLimit.limit * wipLimit.warningThreshold;

  return (
    <div
      ref={setNodeRef}
      data-testid={KANBAN.column(status)}
      className={cn(
        collapsed
          ? 'flex min-w-[60px] max-w-[60px] flex-shrink-0 flex-col rounded-xl'
          : 'flex min-w-[260px] max-w-[300px] flex-shrink-0 flex-col rounded-xl transition-all duration-300 sm:min-w-[280px] sm:max-w-[320px]',
        'bg-surface-100/60 dark:bg-surface-800/40',
        'border-l-2',
        statusBorderAccent[status] ?? 'border-l-surface-300',
        // Drop indicator
        isOver &&
          isValidDropTarget !== false &&
          !isOverWipLimit &&
          'ring-brand-400 bg-brand-50/40 dark:bg-brand-900/20 scale-[1.02] ring-2 ring-inset',
        isOver &&
          isValidDropTarget === false &&
          'scale-[1.02] bg-red-50/40 ring-2 ring-inset ring-red-400 dark:bg-red-900/20',
        isOver && isOverWipLimit &&
          'scale-[1.02] bg-amber-50/40 ring-2 ring-inset ring-amber-400 dark:bg-amber-900/20',
        'hover:shadow-sm',
      )}
    >
      {/* Column Header */}
      <div
        data-testid={KANBAN.columnHeader(status)}
        className={cn(
          'border-surface-200/60 dark:border-surface-700/60 flex items-center justify-between rounded-t-xl',
          collapsed ? 'justify-center border-b-0 px-2 py-3' : 'border-b px-3 py-3',
          headerBg,
          isOverWipLimit && 'border-red-500/30',
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={onToggleCollapse}
              className="flex flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-surface-200/50 dark:hover:bg-surface-700/50"
              aria-label={`Expand ${label}`}
              title={label}
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: lanes.length > 0 ? Infinity : 0, ease: 'easeInOut' }}
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  statusDotColors[status] ?? 'bg-surface-400',
                  isOverWipLimit && 'ring-2 ring-red-400 ring-offset-1',
                )}
              />
              <span className="text-surface-500 dark:text-surface-400 text-[10px] font-semibold" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                {label}
              </span>
            </motion.button>
            <span className="text-surface-400 dark:text-surface-500 text-[10px] font-medium">
              {lanes.reduce((sum, g) => sum + g.tasks.length, 0)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={onToggleCollapse}
                className="rounded p-0.5 transition-colors hover:bg-surface-200/50 dark:hover:bg-surface-700/50"
                aria-label={`Collapse ${label}`}
              >
                <ChevronDown className="text-surface-400 h-3.5 w-3.5" />
              </motion.button>
              <motion.span
                animate={isOver ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  statusDotColors[status] ?? 'bg-surface-400',
                  isOverWipLimit && 'ring-2 ring-red-400 ring-offset-1',
                )}
              />
              <h3 className="text-surface-700 dark:text-surface-300 truncate text-sm font-semibold">
                {label}
              </h3>
              <motion.span
                key={lanes.reduce((sum, g) => sum + g.tasks.length, 0)}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={cn(
                  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums',
                  isOverWipLimit
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                    : isNearWipLimit
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-surface-200/70 dark:bg-surface-700/70 text-surface-500 dark:text-surface-400',
                )}
              >
                {lanes.reduce((sum, g) => sum + g.tasks.length, 0)}
              </motion.span>

              {/* WIP Limit Badge */}
              {wipLimit && wipCount !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium',
                    isOverWipLimit
                      ? 'bg-red-500/10 text-red-500'
                      : isNearWipLimit
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'text-surface-400',
                  )}
                >
                  {isOverWipLimit && <AlertTriangle className="h-2.5 w-2.5" />}
                  /{wipLimit.limit}
                </span>
              )}
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
          </>
        )}
      </div>

      {/* Task Lanes */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            key="task-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="flex min-h-[120px] flex-1 flex-col gap-1 overflow-hidden p-3"
          >
            {lanes.length === 0 || lanes.every((g) => g.tasks.length === 0) ? (
              <motion.div
                key="empty"
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
              <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                {lanes.map((lane, laneIdx) => (
                  <div key={lane.id} className="flex flex-col">
                    {/* Swimlane Header */}
                    {swimlaneMode !== 'none' && lanes.length > 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: laneIdx * 0.02 }}
                        className="mb-1 flex items-center gap-1.5 rounded-md bg-surface-200/40 px-2 py-1 dark:bg-surface-700/30"
                      >
                        {swimlaneMode === 'assignee' && (
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/10 text-[8px] font-medium text-brand-500">
                            {lane.label.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {swimlaneMode === 'priority' && (
                          <div className="flex h-4 w-4 items-center justify-center">
                            <ArrowUpDown className="h-3 w-3 text-surface-400" />
                          </div>
                        )}
                        <span className="text-surface-500 dark:text-surface-400 truncate text-[10px] font-medium">
                          {lane.label}
                        </span>
                        <span className="text-surface-400 ml-auto text-[9px] tabular-nums">
                          {lane.count}
                        </span>
                      </motion.div>
                    )}

                    {/* Task Cards in Lane */}
                    <div className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {lane.tasks.map((task, cardIdx) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{
                              type: 'spring',
                              stiffness: 300,
                              damping: 25,
                              delay: cardIdx * 0.02,
                            }}
                          >
                            <KanbanCard task={task} onTap={onCardTap} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </SortableContext>
            )}

            {/* WIP limit warning at bottom of column */}
            {!isOver && isOverWipLimit && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/5 px-2.5 py-1.5 text-[10px] font-medium text-red-500"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>WIP limit reached ({wipLimit!.limit})</span>
              </motion.div>
            )}
            {!isOver && isNearWipLimit && !isOverWipLimit && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/5 px-2.5 py-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>Approaching WIP limit ({wipCount}/{wipLimit!.limit})</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
