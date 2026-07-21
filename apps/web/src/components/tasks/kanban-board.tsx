'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { isValidTransition } from '@/lib/api/validation';
import { KANBAN } from '@/lib/test-ids';

// ─── Workflow Columns ──────────────────────────────────────────

interface ColumnDef {
  status: string;
  label: string;
  headerBg: string;
}

const COLUMN_HEADER_BG: Record<string, string> = {
  draft: 'bg-status-draft/5 dark:bg-status-draft/10',
  open: 'bg-status-open/5 dark:bg-status-open/10',
  assigned: 'bg-status-on-hold/5 dark:bg-status-on-hold/10',
  in_progress: 'bg-status-in-progress/5 dark:bg-status-in-progress/10',
  blocked: 'bg-status-blocked/5 dark:bg-status-blocked/10',
  on_hold: 'bg-status-on-hold/5 dark:bg-status-on-hold/10',
  under_review: 'bg-status-under-review/5 dark:bg-status-under-review/10',
  approved: 'bg-status-approved/5 dark:bg-status-approved/10',
  completed: 'bg-status-completed/5 dark:bg-status-completed/10',
  closed: 'bg-status-closed/5 dark:bg-status-closed/10',
  reopened: 'bg-status-approved/5 dark:bg-status-approved/10',
  cancelled: 'bg-status-cancelled/5 dark:bg-status-cancelled/10',
  archived: 'bg-status-archived/5 dark:bg-status-archived/10',
  rejected: 'bg-status-rejected/5 dark:bg-status-rejected/10',
};

const WORKFLOW_COLUMNS: ColumnDef[] = [
  { status: 'draft', label: 'Draft', headerBg: COLUMN_HEADER_BG.draft! },
  { status: 'open', label: 'Open', headerBg: COLUMN_HEADER_BG.open! },
  { status: 'assigned', label: 'Assigned', headerBg: COLUMN_HEADER_BG.assigned! },
  { status: 'in_progress', label: 'In Progress', headerBg: COLUMN_HEADER_BG.in_progress! },
  { status: 'blocked', label: 'Blocked', headerBg: COLUMN_HEADER_BG.blocked! },
  { status: 'under_review', label: 'Review', headerBg: COLUMN_HEADER_BG.under_review! },
  { status: 'completed', label: 'Done', headerBg: COLUMN_HEADER_BG.completed! },
  { status: 'closed', label: 'Closed', headerBg: COLUMN_HEADER_BG.closed! },
];

const SECONDARY_STATUSES = new Set([
  'on_hold',
  'reopened',
  'cancelled',
  'archived',
  'approved',
  'rejected',
]);

// ─── Task Type ─────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskIdDisplay: string;
  assignedTo: string | null;
  dueDate: string | null;
}

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
}

// ─── Board Component ───────────────────────────────────────────

export function KanbanBoard({ tasks, onStatusChange }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSourceStatus, setActiveSourceStatus] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  // Group tasks by status
  const groups = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    for (const task of tasks) {
      const s = task.status;
      if (!grouped[s]) {
        grouped[s] = [];
      }
      grouped[s]!.push(task);
    }
    return grouped;
  }, [tasks]);

  // Collect columns to show: primary workflow + any extras with tasks
  const columns = useMemo(() => {
    const cols: ColumnDef[] = [...WORKFLOW_COLUMNS];
    const seen = new Set(cols.map((c) => c.status));
    for (const status of Object.keys(groups)) {
      if (!seen.has(status) && !SECONDARY_STATUSES.has(status)) {
        cols.push({
          status,
          label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          headerBg: COLUMN_HEADER_BG[status] ?? '',
        });
        seen.add(status);
      }
    }
    // Add secondary statuses that have tasks
    for (const status of SECONDARY_STATUSES) {
      if (groups[status] && groups[status]!.length > 0 && !seen.has(status)) {
        cols.push({
          status,
          label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          headerBg: COLUMN_HEADER_BG[status] ?? '',
        });
        seen.add(status);
      }
    }
    return cols;
  }, [groups]);

  // Determine if the dragged card can be dropped in a given column
  const isDropValid = useCallback(
    (targetStatus: string): boolean | undefined => {
      if (!activeSourceStatus) return undefined;
      if (targetStatus === activeSourceStatus) return true;
      return isValidTransition(activeSourceStatus, targetStatus);
    },
    [activeSourceStatus],
  );

  // ── Drag Handlers ──────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    const sourceStatus = event.active.data.current?.status as string | undefined;
    if (task) {
      setActiveTask(task);
      setActiveSourceStatus(sourceStatus ?? task.status);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) {
        setActiveTask(null);
        setActiveSourceStatus(null);
        return;
      }

      const task = active.data.current?.task as Task | undefined;
      if (!task) {
        setActiveTask(null);
        setActiveSourceStatus(null);
        return;
      }

      // Determine target status:
      // 1. If the drop target is a column (has 'status' in data), use that
      // 2. If the drop target is a task card (has 'task' in data), extract its status
      const overIsColumn = over.data.current?.status !== undefined && !over.data.current?.task;
      const overIsCard = over.data.current?.task !== undefined;

      let targetStatus: string;
      if (overIsColumn) {
        targetStatus = over.data.current!.status as string;
      } else if (overIsCard) {
        targetStatus = (over.data.current!.task as Task).status;
      } else {
        // Fallback: stay in same column
        targetStatus = task.status;
      }

      setActiveTask(null);
      setActiveSourceStatus(null);

      // Don't call API if status didn't change or transition is invalid
      if (targetStatus === task.status) return;
      if (!isValidTransition(task.status, targetStatus)) return;

      // Optimistic update + API call
      try {
        await onStatusChange(task.id, targetStatus);
      } catch {
        // Revert handled by parent via refetch
        console.error('Failed to update task status');
      }
    },
    [onStatusChange],
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04 },
    },
  };

  const columnVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 },
    },
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <motion.div
        data-testid={KANBAN.container}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-surface-300) transparent',
        }}
      >
        {columns.map((col, idx) => (
          <motion.div
            key={col.status}
            variants={columnVariants}
            custom={idx}
            className="flex-shrink-0"
          >
            <KanbanColumn
              status={col.status}
              label={col.label}
              tasks={groups[col.status] ?? []}
              headerBg={col.headerBg}
              isValidDropTarget={activeTask ? isDropValid(col.status) : undefined}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Drag Overlay — shows the card being dragged */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[280px]" data-testid={KANBAN.dragOverlay}>
            <KanbanCard task={activeTask} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
