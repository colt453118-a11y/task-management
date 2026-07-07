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
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { isValidTransition } from '@/lib/api/validation';

// ─── Workflow Columns ──────────────────────────────────────────

interface ColumnDef {
  status: string;
  label: string;
  color: string;
}

const WORKFLOW_COLUMNS: ColumnDef[] = [
  { status: 'draft',       label: 'Draft',       color: '' },
  { status: 'open',        label: 'Open',        color: '' },
  { status: 'assigned',    label: 'Assigned',    color: '' },
  { status: 'in_progress', label: 'In Progress', color: '' },
  { status: 'blocked',     label: 'Blocked',     color: '' },
  { status: 'under_review',label: 'Review',      color: '' },
  { status: 'completed',   label: 'Done',        color: '' },
  { status: 'closed',      label: 'Closed',      color: '' },
];

const SECONDARY_STATUSES = new Set(['on_hold', 'reopened', 'cancelled', 'archived', 'approved', 'rejected']);

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
      grouped[s].push(task);
    }
    return grouped;
  }, [tasks]);

  // Collect columns to show: primary workflow + any extras with tasks
  const columns = useMemo(() => {
    const cols: ColumnDef[] = [...WORKFLOW_COLUMNS];
    const seen = new Set(cols.map((c) => c.status));
    for (const status of Object.keys(groups)) {
      if (!seen.has(status) && !SECONDARY_STATUSES.has(status)) {
        cols.push({ status, label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), color: '' });
        seen.add(status);
      }
    }
    // Add secondary statuses that have tasks
    for (const status of SECONDARY_STATUSES) {
      if (groups[status] && groups[status].length > 0 && !seen.has(status)) {
        cols.push({ status, label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), color: '' });
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

      // Determine target status from the droppable column
      const overStatus = over.data.current?.status as string | undefined;
      const targetStatus = overStatus ?? task.status;

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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-3 pb-4 overflow-x-auto overflow-y-hidden"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-surface-300) transparent',
        }}
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            tasks={groups[col.status] ?? []}
            color={col.color}
            isValidDropTarget={activeTask ? isDropValid(col.status) : undefined}
          />
        ))}
      </div>

      {/* Drag Overlay — shows the card being dragged */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[280px]">
            <KanbanCard task={activeTask} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
