'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flag,
  Calendar,
  User,
  ArrowLeft,
  FolderOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { StatusChip, PriorityChip } from '@/components/ui/chip';
import { AccentBar } from '@/components/ui/accent-bar';
import { EmptyState } from '@/components/ui/state-display';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { containerVariants, itemVariants } from '@/lib/motion/variants';

export type ProjectDetail = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  owner: { id: string; name: string | null; email: string } | null;
};

export type TaskStats = {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  byStatus: { status: string; count: number }[];
};

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskIdDisplay: string;
  dueDate: string | null;
};

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'info'> = {
  active: 'success',
  planning: 'info',
  on_hold: 'warning',
  completed: 'primary',
  archived: 'default',
  cancelled: 'default',
};

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
}

interface ProjectDetailClientProps {
  /** Server-rendered project; null means the server load failed/not-found and the client should fetch. */
  initialProject: ProjectDetail | null;
  initialTaskStats: TaskStats | null;
  initialMilestones: number;
}

export function ProjectDetailClient({
  initialProject,
  initialTaskStats,
  initialMilestones,
}: ProjectDetailClientProps) {
  const params = useParams();
  const projectId = params.id as string;

  const [hadInitialData] = useState(() => initialProject !== null);
  const [project, setProject] = useState<ProjectDetail | null>(initialProject);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(initialTaskStats);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [loading, setLoading] = useState(initialProject === null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // The project's task list is secondary content — always loaded client-side.
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        throw new Error('Failed to load project');
      }
      const data = await res.json();
      setProject(data.project);
      setTaskStats(data.taskStats ?? null);
      setMilestones(data.milestones?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fallback: fetch the project only when the server didn't seed it.
  useEffect(() => {
    if (hadInitialData) return;
    startTransition(() => {
      fetchProject();
    });
  }, [hadInitialData, fetchProject]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks?projectId=${projectId}&limit=50`)
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((d) => {
        if (!cancelled) setTasks(d.tasks ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="animate-fade-in max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="shimmer h-4 w-24 rounded-lg" />
          <div className="shimmer h-8 w-64 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="neon-card rounded-2xl p-4">
              <div className="shimmer h-3 w-16 rounded-lg" />
              <div className="shimmer mt-3 h-8 w-12 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="neon-card rounded-2xl p-6">
          <div className="shimmer h-4 w-40 rounded-lg" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="shimmer h-8 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || (!project && !error)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen className="text-surface-400 mb-4 h-12 w-12" />
        <h2 className="text-surface-900 text-xl font-semibold">Project not found</h2>
        <p className="text-surface-500 mt-1 text-sm">
          This project may have been deleted or you don&apos;t have access.
        </p>
        <Link href="/projects" className="mt-4">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to projects
          </Button>
        </Link>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="text-error mb-4 h-12 w-12" />
        <h2 className="text-surface-900 text-xl font-semibold">Failed to load project</h2>
        <p className="text-error mt-1 text-sm">{error}</p>
        <Button variant="outline" onClick={fetchProject} className="mt-4 rounded-xl">
          Try again
        </Button>
      </div>
    );
  }

  const stats = taskStats;

  return (
    <motion.div
      variants={containerVariants}
      initial={hadInitialData ? false : 'hidden'}
      animate="visible"
      className="max-w-6xl space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <PageHeader
          breadcrumb={
            <Link
              href="/projects"
              className="hover:text-surface-700 inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Projects
            </Link>
          }
          title={project.name}
          subtitle={project.code ? <span className="font-mono">{project.code}</span> : undefined}
          actions={
            <div className="flex items-center gap-2">
              <PriorityChip priority={project.priority} />
              <Badge variant={statusBadge[project.status] ?? 'default'} size="sm">
                {formatStatus(project.status)}
              </Badge>
            </div>
          }
        />
      </motion.div>

      {/* Meta rail */}
      <motion.div variants={itemVariants}>
        <div className="neon-card relative overflow-hidden rounded-2xl p-5">
          <AccentBar />
          {project.description && (
            <p className="text-surface-600 mb-4 text-sm leading-relaxed">{project.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <User className="text-surface-400 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
                  Owner
                </p>
                <p className="text-surface-800 truncate text-sm">
                  {project.owner?.name ?? project.owner?.email ?? 'Unassigned'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="text-surface-400 h-4 w-4 shrink-0" />
              <div>
                <p className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
                  Start
                </p>
                <p className="text-surface-800 text-sm">{formatDate(project.startDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="text-surface-400 h-4 w-4 shrink-0" />
              <div>
                <p className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
                  Due
                </p>
                <p className="text-surface-800 text-sm">{formatDate(project.endDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flag className="text-surface-400 h-4 w-4 shrink-0" />
              <div>
                <p className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
                  Milestones
                </p>
                <p className="text-surface-800 text-sm tabular-nums">{milestones}</p>
              </div>
            </div>
          </div>
          {/* Progress */}
          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
                Progress
              </span>
              <span className="text-brand-400 font-semibold tabular-nums">{project.progress}%</span>
            </div>
            <div className="bg-surface-300/40 h-2 overflow-hidden rounded-full">
              <motion.div
                initial={hadInitialData ? false : { width: 0 }}
                animate={{ width: `${project.progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="from-brand-500 to-brand-400 h-full rounded-full bg-gradient-to-r shadow-[0_0_8px_rgba(138,120,255,0.5)]"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI row */}
      {stats && (
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Total Tasks"
              value={stats.total}
              icon={<ListTodo className="h-4 w-4" />}
              color="var(--color-brand-500)"
            />
            <StatCard
              label="Completed"
              value={stats.completed}
              icon={<CheckCircle2 className="h-4 w-4" />}
              color="var(--color-status-completed)"
            />
            <StatCard
              label="In Progress"
              value={stats.inProgress}
              icon={<Clock className="h-4 w-4" />}
              color="var(--color-status-in-progress)"
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              icon={<AlertTriangle className="h-4 w-4" />}
              color="var(--color-status-blocked)"
            />
          </div>
        </motion.div>
      )}

      {/* Tasks */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-surface-700 flex items-center gap-2 text-sm font-semibold">
          <ListTodo className="h-4 w-4" /> Tasks
          {!tasksLoading && (
            <span className="text-surface-500 text-xs font-normal">({tasks.length})</span>
          )}
        </h2>
        {tasksLoading ? (
          <div className="neon-card space-y-3 rounded-2xl p-6">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="shimmer h-8 rounded-xl" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="text-surface-300 h-12 w-12" />}
            title="No tasks in this project"
            message="Tasks assigned to this project will appear here."
            variant="bordered"
          />
        ) : (
          <Table>
            <THead>
              <TR header>
                <TH className="hidden sm:table-cell">ID</TH>
                <TH>Title</TH>
                <TH>Status</TH>
                <TH className="hidden sm:table-cell">Priority</TH>
                <TH>Due</TH>
              </TR>
            </THead>
            <TBody>
              {tasks.map((task) => (
                <TR key={task.id}>
                  <TD className="text-surface-500 hidden font-mono text-xs sm:table-cell">
                    {task.taskIdDisplay}
                  </TD>
                  <TD>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-surface-800 hover:text-brand-400 font-medium transition-colors"
                    >
                      {task.title}
                    </Link>
                  </TD>
                  <TD>
                    <StatusChip status={task.status} size="sm" />
                  </TD>
                  <TD className="hidden sm:table-cell">
                    <PriorityChip priority={task.priority} size="sm" />
                  </TD>
                  <TD className="text-surface-500 text-xs">{formatDate(task.dueDate)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </motion.div>
    </motion.div>
  );
}
