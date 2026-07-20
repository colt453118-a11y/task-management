'use client';

import { useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/stores/task-store';
import { TaskDependencyGraph } from '@/components/tasks/task-dependency-graph';

// ─── Props ──────────────────────────────────────────────────

interface TaskDependencySectionProps {
  taskId: string;
  /** Optional motion variants for use with parent stagger animations */
  variants?: Variants;
  /** Additional className for the outer card */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

/**
 * A self-contained dependency section that reads blockedBy/blocking
 * from the Zustand task store and provides automatic refetching
 * when dependencies are added or removed.
 *
 * Intended as a drop-in replacement for the inline pattern used
 * in the task detail page's sidebar.
 */
export function TaskDependencySection({
  taskId,
  variants,
  className,
}: TaskDependencySectionProps) {
  const blockedBy = useTaskStore((s) => s.blockedBy);
  const blocking = useTaskStore((s) => s.blocking);
  const setDependencies = useTaskStore((s) => s.setDependencies);

  const refetchDependencies = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`);
      if (res.ok) {
        const data = await res.json();
        setDependencies(data.blockedBy ?? [], data.blocking ?? []);
      }
    } catch {
      // silent
    }
  }, [taskId, setDependencies]);

  return (
    <motion.div
      variants={variants}
      className={cn(
        'border-surface-300/20 bg-surface-100/80 overflow-hidden rounded-2xl border',
        className,
      )}
    >
      <div className="px-5 py-4">
        <TaskDependencyGraph
          blockedBy={blockedBy}
          blocking={blocking}
          taskId={taskId}
          onDependencyAdded={refetchDependencies}
          onDependencyRemoved={refetchDependencies}
        />
      </div>
    </motion.div>
  );
}
