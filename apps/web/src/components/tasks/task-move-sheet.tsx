'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TASK_STATUS_TRANSITIONS } from '@/lib/api/validation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Move, X } from 'lucide-react';

// ─── Status display config ────────────────────────────────────
// Maps status values to human labels and visual accents.
// Shares the same color palette as the Kanban columns.

const STATUS_META: Record<string, { label: string; dotColor: string; borderColor: string }> = {
  draft:        { label: 'Draft',       dotColor: 'bg-status-draft',       borderColor: 'border-l-status-draft' },
  open:         { label: 'Open',        dotColor: 'bg-status-open',        borderColor: 'border-l-status-open' },
  assigned:     { label: 'Assigned',    dotColor: 'bg-status-on-hold',     borderColor: 'border-l-status-on-hold' },
  in_progress:  { label: 'In Progress', dotColor: 'bg-status-in-progress', borderColor: 'border-l-status-in-progress' },
  blocked:      { label: 'Blocked',     dotColor: 'bg-status-blocked',     borderColor: 'border-l-status-blocked' },
  on_hold:      { label: 'On Hold',     dotColor: 'bg-status-on-hold',     borderColor: 'border-l-status-on-hold' },
  under_review: { label: 'Under Review',dotColor: 'bg-status-under-review',borderColor: 'border-l-status-under-review' },
  completed:    { label: 'Completed',   dotColor: 'bg-status-completed',   borderColor: 'border-l-status-completed' },
  closed:       { label: 'Closed',      dotColor: 'bg-status-closed',      borderColor: 'border-l-status-closed' },
  reopened:     { label: 'Reopened',    dotColor: 'bg-status-approved',     borderColor: 'border-l-status-approved' },
  cancelled:    { label: 'Cancelled',   dotColor: 'bg-status-cancelled',   borderColor: 'border-l-status-cancelled' },
  archived:     { label: 'Archived',    dotColor: 'bg-status-archived',    borderColor: 'border-l-status-archived' },
  approved:     { label: 'Approved',    dotColor: 'bg-status-approved',    borderColor: 'border-l-status-approved' },
  rejected:     { label: 'Rejected',    dotColor: 'bg-status-rejected',    borderColor: 'border-l-status-rejected' },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    dotColor: 'bg-surface-400',
    borderColor: 'border-l-surface-400',
  };
}

// ─── Props ────────────────────────────────────────────────────

interface TaskMoveSheetProps {
  task: {
    id: string;
    title: string;
    status: string;
    taskIdDisplay: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (taskId: string, newStatus: string) => Promise<void>;
}

// ─── Loading state for in-progress moves ──────────────────────

// ─── Component ────────────────────────────────────────────────

export function TaskMoveSheet({ task, open, onOpenChange, onMove }: TaskMoveSheetProps) {
  const currentStatusMeta = task ? getStatusMeta(task.status) : null;

  type TargetEntry = { key: string; label: string; dotColor: string; borderColor: string };

  const validTargets: TargetEntry[] = task
    ? (TASK_STATUS_TRANSITIONS[task.status] ?? [])
        .map((key) => ({ key, ...getStatusMeta(key) }))
    : [];

  const handleMove = useCallback(
    async (newStatus: string) => {
      if (!task) return;
      onOpenChange(false);
      await onMove(task.id, newStatus);
    },
    [task, onOpenChange, onMove],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Bottom-sheet style on mobile, centered dialog on desktop
          'data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full',
          'sm:data-[state=open]:slide-in-from-bottom-none sm:data-[state=closed]:slide-out-to-bottom-none',
          'bottom-0 top-auto translate-y-0 sm:bottom-auto sm:top-[50%] sm:-translate-y-1/2',
          'max-h-[80vh] overflow-y-auto rounded-t-2xl border-b-0 sm:rounded-2xl sm:border-b',
          'p-0 sm:p-6',
        )}
      >
        {/* Drag handle indicator — mobile only */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="bg-surface-300 h-1 w-10 rounded-full" />
        </div>

        <div className="px-4 pb-4 pt-2 sm:p-0">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <DialogTitle className="text-surface-900 text-base font-semibold sm:text-lg">
                Move task
              </DialogTitle>
              <DialogDescription className="sr-only">
                Select a new status to move this task to
              </DialogDescription>
            </div>
          </div>

          {/* Current task pill */}
          {task && currentStatusMeta && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-100/50 px-3 py-2 ">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', currentStatusMeta.dotColor)} />
              <span className="text-surface-500 truncate text-xs font-medium">
                {task.taskIdDisplay}
              </span>
              <span className="text-surface-700 flex-1 truncate text-sm font-medium">
                {task.title}
              </span>
            </div>
          )}

          {/* Transition arrow from current status */}
          <div className="mb-3 flex items-center gap-2">
            {currentStatusMeta && (
              <span className={cn('h-2.5 w-2.5 rounded-full', currentStatusMeta.dotColor)} />
            )}
            <span className="text-surface-500 text-xs font-medium">Current: {currentStatusMeta?.label ?? task?.status}</span>
          </div>

          {/* Valid target statuses */}
          <div className="space-y-1" role="listbox" aria-label="Available status transitions">
            {validTargets.length === 0 ? (
              <p className="text-surface-400 py-4 text-center text-sm">
                No further transitions available from this status.
              </p>
            ) : (
              <AnimatePresence>
                {validTargets.map((target, idx) => (
                  <motion.button
                    key={target.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={() => handleMove(target.key)}
                    role="option"
                    aria-selected={false}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200',
                      'hover:bg-surface-100 ',
                      'focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2',
                      'border-l-4',
                      target.borderColor,
                      'border border-surface-200/50 ',
                      'hover:border-surface-300 ',
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', target.dotColor)} />
                    <div className="flex-1">
                      <span className="text-surface-900 text-sm font-medium">
                        {target.label}
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="text-surface-300 group-hover:text-surface-500 rounded-full p-1 transition-colors"
                    >
                      <Move className="h-3.5 w-3.5" />
                    </motion.div>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Cancel */}
          <button
            onClick={() => onOpenChange(false)}
            className={cn(
              'mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
              'text-surface-500 hover:text-surface-700 ',
              'hover:bg-surface-100 ',
              'focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2',
              'border border-surface-200 ',
            )}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
