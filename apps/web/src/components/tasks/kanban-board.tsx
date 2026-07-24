'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { TaskMoveSheet } from './task-move-sheet';
import { isValidTransition } from '@/lib/api/validation';
import { KANBAN } from '@/lib/test-ids';
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Columns3,
  User,
  AlertTriangle,
  GripVertical,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

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

// ─── WIP Limits ────────────────────────────────────────────────

export interface WIPLimitConfig {
  [status: string]: { limit: number; warningThreshold: number };
}

const DEFAULT_WIP_LIMITS: WIPLimitConfig = {
  draft: { limit: 10, warningThreshold: 0.8 },
  open: { limit: 15, warningThreshold: 0.8 },
  assigned: { limit: 10, warningThreshold: 0.8 },
  in_progress: { limit: 8, warningThreshold: 0.75 },
  blocked: { limit: 5, warningThreshold: 0.8 },
  under_review: { limit: 6, warningThreshold: 0.8 },
  completed: { limit: 20, warningThreshold: 0.9 },
  closed: { limit: 30, warningThreshold: 0.9 },
};

// ─── Swimlane types ────────────────────────────────────────────

type SwimlaneMode = 'none' | 'assignee' | 'priority';

interface SwimlaneGroup {
  id: string;
  label: string;
  count: number;
  tasks: Task[];
}

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
  onReorder?: (taskId: string, newStatus: string, orderedIds: string[]) => Promise<void>;
  wipLimits?: WIPLimitConfig;
}

// ─── Auto-scroll Configuration ────────────────────────────────

const SCROLL_THRESHOLD = 60;
const SCROLL_SPEED_BASE = 8;
const SCROLL_SPEED_MAX = 24;

// ─── Board Component ───────────────────────────────────────────

export function KanbanBoard({ tasks, onStatusChange, onReorder, wipLimits }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSourceStatus, setActiveSourceStatus] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>('none');
  const [moveSheetTask, setMoveSheetTask] = useState<Task | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnimRef = useRef<number | null>(null);

  // Separate sensors for mouse (desktop) and touch (mobile):
  // - MouseSensor: activates after 6px of mouse movement — instant drag on desktop
  // - TouchSensor: requires 250ms hold + 5px tolerance before drag starts on mobile
  //   This prevents accidental drags when scrolling the board on touch devices
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  );

  // Merge default WIP limits with any custom overrides
  const effectiveWipLimits = useMemo(
    () => ({ ...DEFAULT_WIP_LIMITS, ...wipLimits }),
    [wipLimits],
  );

  // ── Filtered Tasks ──────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.taskIdDisplay.toLowerCase().includes(q) ||
        (t.assignedTo && t.assignedTo.toLowerCase().includes(q)),
    );
  }, [tasks, searchQuery]);

  // Group tasks by status
  const groups = useMemo(() => {
    const grouped: Record<string, SwimlaneGroup[]> = {};
    for (const task of filteredTasks) {
      const s = task.status;
      if (!grouped[s]) {
        grouped[s] = [];
      }

      if (swimlaneMode === 'none') {
        // Flat mode — one group per column
        if (grouped[s]!.length === 0) {
          grouped[s]!.push({ id: `${s}-all`, label: 'All', count: 0, tasks: [] });
        }
        grouped[s]![0]!.tasks.push(task);
        grouped[s]![0]!.count++;
      } else if (swimlaneMode === 'assignee') {
        // Group by assignee
        const assignee = task.assignedTo || 'Unassigned';
        let lane = grouped[s]!.find((g) => g.id === `assignee-${assignee}`);
        if (!lane) {
          lane = { id: `assignee-${assignee}`, label: assignee, count: 0, tasks: [] };
          grouped[s]!.push(lane);
        }
        lane.tasks.push(task);
        lane.count++;
      } else if (swimlaneMode === 'priority') {
        // Group by priority
        const pri = task.priority || 'none';
        let lane = grouped[s]!.find((g) => g.id === `priority-${pri}`);
        if (!lane) {
          lane = {
            id: `priority-${pri}`,
            label: pri.charAt(0).toUpperCase() + pri.slice(1),
            count: 0,
            tasks: [],
          };
          grouped[s]!.push(lane);
        }
        lane.tasks.push(task);
        lane.count++;
      }
    }

    // Sort lanes within each status column
    for (const status of Object.keys(grouped)) {
      grouped[status]!.sort((a, b) => b.count - a.count);
    }

    return grouped;
  }, [filteredTasks, swimlaneMode]);

  // Collect columns to show
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

  const isDropValid = useCallback(
    (targetStatus: string): boolean | undefined => {
      if (!activeSourceStatus) return undefined;
      if (targetStatus === activeSourceStatus) return true;
      return isValidTransition(activeSourceStatus, targetStatus);
    },
    [activeSourceStatus],
  );

  // Check if a target column is at its WIP limit
  const isAtWipLimit = useCallback(
    (targetStatus: string): boolean => {
      if (swimlaneMode !== 'none') return false; // WIP limits only apply in flat mode
      const config = effectiveWipLimits[targetStatus];
      if (!config) return false;
      const currentCount = filteredTasks.filter((t) => t.status === targetStatus).length;
      return currentCount >= config.limit;
    },
    [effectiveWipLimits, filteredTasks, swimlaneMode],
  );

  // ── Collapse / Expand ───────────────────────────────────────

  const toggleCollapse = useCallback((status: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedColumns(new Set(columns.map((c) => c.status)));
  }, [columns]);

  const expandAll = useCallback(() => {
    setCollapsedColumns(new Set());
  }, []);

  // ── Auto-scroll While Dragging ──────────────────────────────

  const performAutoScroll = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const distFromLeft = relX;
    const distFromRight = rect.width - relX;

    let speed = 0;
    if (distFromLeft < SCROLL_THRESHOLD) {
      speed = -SCROLL_SPEED_BASE - (SCROLL_SPEED_MAX - SCROLL_SPEED_BASE) * (1 - distFromLeft / SCROLL_THRESHOLD);
    } else if (distFromRight < SCROLL_THRESHOLD) {
      speed = SCROLL_SPEED_BASE + (SCROLL_SPEED_MAX - SCROLL_SPEED_BASE) * (1 - distFromRight / SCROLL_THRESHOLD);
    }

    if (speed !== 0) {
      el.scrollLeft += speed;
      scrollAnimRef.current = requestAnimationFrame(() => performAutoScroll(clientX));
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current !== null) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  // ── Tap-to-Move Action Sheet ───────────────────────────────

  const handleCardTap = useCallback((task: Task) => {
    setMoveSheetTask(task);
  }, []);

  // ── Drag Handlers ──────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    const sourceStatus = event.active.data.current?.status as string | undefined;
    if (task) {
      setActiveTask(task);
      setActiveSourceStatus(sourceStatus ?? task.status);
      triggerHaptic('pickup');
    }
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      stopAutoScroll();
      const { activatorEvent } = event;
      if (activatorEvent && 'clientX' in activatorEvent) {
        performAutoScroll((activatorEvent as { clientX: number }).clientX);
      }
    },
    [performAutoScroll, stopAutoScroll],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      stopAutoScroll();
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

      const overIsColumn = over.data.current?.status !== undefined && !over.data.current?.task;
      const overIsCard = over.data.current?.task !== undefined;

      let targetStatus: string;
      if (overIsColumn) {
        targetStatus = over.data.current!.status as string;
      } else if (overIsCard) {
        targetStatus = (over.data.current!.task as Task).status;
      } else {
        targetStatus = task.status;
      }

      setActiveTask(null);
      setActiveSourceStatus(null);

      // In-column reorder — same status, different position
      if (targetStatus === task.status) {
        const columnTasks = tasks.filter((t) => t.status === targetStatus);
        const oldIndex = columnTasks.findIndex((t) => t.id === task.id);
        let newIndex: number;
        if (overIsCard) {
          newIndex = columnTasks.findIndex((t) => t.id === over.id);
        } else {
          newIndex = columnTasks.length - 1;
        }

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columnTasks, oldIndex, newIndex);
          const orderedIds = reordered.map((t) => t.id);
          onReorder?.(task.id, targetStatus, orderedIds);
          triggerHaptic('drop');
        }

        setActiveTask(null);
        setActiveSourceStatus(null);
        return;
      }
      if (!isValidTransition(task.status, targetStatus)) {
        triggerHaptic('error');
        return;
      }
      if (isAtWipLimit(targetStatus)) {
        triggerHaptic('error');
        return;
      }

      try {
        await onStatusChange(task.id, targetStatus);
        triggerHaptic('drop');
      } catch {
        console.error('Failed to update task status');
      }
    },
    [onStatusChange, onReorder, tasks, stopAutoScroll, isAtWipLimit],
  );

  // ── Collapse / Expand Controls ──────────────────────────────

  const allCollapsed = collapsedColumns.size === columns.length;
  const anyCollapsed = collapsedColumns.size > 0;

  // ── Swimlane options ────────────────────────────────────────

  const SWIMLANE_OPTIONS: { key: SwimlaneMode; label: string; icon: typeof User }[] = [
    { key: 'none', label: 'Flat', icon: Columns3 },
    { key: 'assignee', label: 'By Assignee', icon: User },
    { key: 'priority', label: 'By Priority', icon: ArrowUpDown },
  ];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-2">
        {/* Filter Bar + Column Controls */}

        {/* First row: Search + Swimlane Toggle + Collapse Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="text-surface-400 absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 sm:left-2.5 sm:h-3.5 sm:w-3.5" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full rounded-lg border bg-white py-1 pl-7 pr-7 text-xs outline-none transition-all sm:py-1.5 sm:pl-8 sm:pr-8 sm:text-sm',
                'border-surface-200 dark:border-surface-700 dark:bg-surface-900',
                'placeholder:text-surface-400 text-surface-700 dark:text-surface-300',
                'focus:border-brand-400 focus:ring-brand-500/20 focus:ring-2',
              )}
              aria-label="Filter tasks"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 sm:right-2"
                aria-label="Clear filter"
              >
                <X className="text-surface-400 h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            )}
          </div>

          {/* Swimlane Toggle */}
          <div
            className="flex items-center gap-0.5 rounded-lg border border-surface-200 bg-white p-0.5 dark:border-surface-700 dark:bg-surface-900 shrink-0"
            role="group"
            aria-label="Swimlane mode"
          >
            {SWIMLANE_OPTIONS.map((opt) => (
              <motion.button
                key={opt.key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSwimlaneMode(opt.key)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-all sm:px-2 sm:text-[11px]',
                  swimlaneMode === opt.key
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300',
                )}
                title={opt.label}
              >
                <opt.icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">{opt.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Collapse / Expand All */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={anyCollapsed ? expandAll : collapseAll}
            className={cn(
              'flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-medium transition-colors sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs',
              'text-surface-500 dark:text-surface-400',
              'hover:bg-surface-100 dark:hover:bg-surface-800 shrink-0',
            )}
            aria-label={allCollapsed ? 'Expand all columns' : 'Collapse all columns'}
          >
            {anyCollapsed ? (
              <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            ) : (
              <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            )}
            <span className="hidden sm:inline">{anyCollapsed ? 'Expand all' : 'Collapse all'}</span>
          </motion.button>
        </div>

        {/* Second row: WIP Limit overview badges */}
        {swimlaneMode === 'none' && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {columns.map((col) => {
              const wip = effectiveWipLimits[col.status];
              if (!wip) return null;
              const count = filteredTasks.filter((t) => t.status === col.status).length;
              const isOverLimit = count >= wip.limit;
              const isNearLimit = count >= wip.limit * wip.warningThreshold;
              if (!isNearLimit && !isOverLimit) return null;

              return (
                <motion.div
                  key={col.status}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    isOverLimit
                      ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  )}
                >
                  {isOverLimit ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <GripVertical className="h-3 w-3" />
                  )}
                  <span>{col.label}: {count}/{wip.limit}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Board */}
        <motion.div
          ref={scrollRef}
          data-testid={KANBAN.container}
          className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--color-surface-300) transparent',
          }}
          layout
        >
          <AnimatePresence mode="popLayout">
            {columns.map((col, idx) => {
              const lanes = groups[col.status] || [];
              const wip = effectiveWipLimits[col.status];

              return (
                <motion.div
                  key={col.status}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 25,
                    delay: idx * 0.03,
                  }}
                  className="flex-shrink-0"
                >
                  <KanbanColumn
                    status={col.status}
                    label={col.label}
                    lanes={lanes}
                    headerBg={col.headerBg}
                    isValidDropTarget={activeTask ? isDropValid(col.status) : undefined}
                    collapsed={collapsedColumns.has(col.status)}
                    onToggleCollapse={() => toggleCollapse(col.status)}
                    swimlaneMode={swimlaneMode}
                    wipLimit={wip}
                    wipCount={wip ? filteredTasks.filter((t) => t.status === col.status).length : undefined}
                    isAtWipLimit={activeTask ? isAtWipLimit(col.status) : undefined}
                    onCardTap={handleCardTap}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Results indicator when filtering */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-surface-400 px-1 text-xs"
            >
              Showing {filteredTasks.length} of {tasks.length} tasks
              {filteredTasks.length === 0 && ' — try a different search term'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask ? (
          <motion.div
            initial={{ scale: 0.95, rotate: -2 }}
            animate={{ scale: 1.05, rotate: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-[260px] sm:w-[280px]"
            data-testid={KANBAN.dragOverlay}
          >
            <KanbanCard task={activeTask} isDragOverlay />
          </motion.div>
        ) : null}
      </DragOverlay>

      {/* Tap-to-Move Action Sheet — fallback for mobile when drag isn't suitable */}
      <TaskMoveSheet
        task={moveSheetTask}
        open={moveSheetTask !== null}
        onOpenChange={(open) => {
          if (!open) setMoveSheetTask(null);
        }}
        onMove={onStatusChange}
      />
    </DndContext>
  );
}
