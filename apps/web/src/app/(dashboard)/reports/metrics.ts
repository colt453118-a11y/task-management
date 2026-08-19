// Server-safe (no 'use client') so both the RSC page.tsx and the client can call
// it. Computes the overview KPI cards from the raw task + project lists.

export interface MetricTask {
  status: string;
  dueDate?: string;
  updatedAt: string;
}

export interface MetricProject {
  status: string;
}

/**
 * `nowMs` is threaded in so the now-relative metrics (overdue, completed-this-week)
 * are computed against a caller-controlled clock rather than an implicit `new Date()`.
 */
export function computeReportMetrics(
  tasks: MetricTask[],
  projects: MetricProject[],
  nowMs: number,
): Record<string, number> {
  const now = new Date(nowMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    totalTasks: tasks.length,
    open: tasks.filter((t) => t.status === 'open').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    closed: tasks.filter((t) => t.status === 'closed').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    overdue: tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < today &&
        !['completed', 'closed', 'cancelled'].includes(t.status),
    ).length,
    completedThisWeek: tasks.filter(
      (t) => t.status === 'completed' && new Date(t.updatedAt) >= weekAgo,
    ).length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    completionRate:
      tasks.length > 0
        ? Math.round(
            (tasks.filter((t) => ['completed', 'closed'].includes(t.status)).length /
              tasks.length) *
              100,
          )
        : 0,
  };
}
