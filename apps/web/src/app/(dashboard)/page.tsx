'use client';

import { useEffect, useState, useCallback, lazy, Suspense, startTransition, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const RechartsCharts = lazy(() => import('@/components/dashboard/recharts-charts'));

interface DashboardMetrics {
  totalTasks: number;
  openTasks: number;
  inProgress: number;
  completedTasks: number;
  closedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  awaitingReview: number;
  totalProjects: number;
  activeProjects: number;
  totalUsers: number;
  completionRate: number;
  upcomingDeadlines: Array<{ id: string; title: string; dueDate: string | null; status: string }>;
  recentActivity: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    assignedTo: string | null;
  }>;
}
interface MetricTask {
  status: string;
  dueDate?: string;
  updatedAt: string;
}
interface MetricProject {
  status: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
} as const;

const statusDotColors: Record<string, string> = {
  draft: 'bg-surface-400',
  open: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  blocked: 'bg-red-500',
  under_review: 'bg-cyan-500',
  on_hold: 'bg-purple-500',
  completed: 'bg-green-500',
  closed: 'bg-indigo-500',
  cancelled: 'bg-surface-400',
  archived: 'bg-surface-500',
} as const;
const statusColors: Record<
  string,
  'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
  draft: 'default',
  open: 'primary',
  in_progress: 'warning',
  blocked: 'danger',
  under_review: 'info',
  on_hold: 'warning',
  completed: 'success',
  closed: 'primary',
  reopened: 'warning',
  cancelled: 'default',
  archived: 'default',
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');

  const fetchMetrics = useCallback(async () => {
    try {
      const [tasksRes, projectsRes, usersRes] = await Promise.all([
        fetch('/api/tasks?limit=500'),
        fetch('/api/projects?limit=500'),
        fetch('/api/users?limit=500'),
      ]);
      if (!tasksRes.ok || !projectsRes.ok || !usersRes.ok)
        throw new Error('Failed to fetch dashboard data');
      const { tasks } = await tasksRes.json();
      const { projects } = await projectsRes.json();
      const { users } = await usersRes.json();
      try {
        const sessionRes = await fetch('/api/auth/get-session');
        const sessionData = await sessionRes.json();
        if (sessionData?.user?.name) setUserName(sessionData.user.name);
      } catch {
        /* best-effort */
      }
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setMetrics({
        totalTasks: tasks.length,
        openTasks: tasks.filter((t: MetricTask) => t.status === 'open' || t.status === 'draft')
          .length,
        inProgress: tasks.filter((t: MetricTask) => t.status === 'in_progress').length,
        completedTasks: tasks.filter((t: MetricTask) => t.status === 'completed').length,
        closedTasks: tasks.filter((t: MetricTask) => t.status === 'closed').length,
        overdueTasks: tasks.filter(
          (t: MetricTask) =>
            t.dueDate &&
            new Date(t.dueDate) < today &&
            !['completed', 'closed', 'cancelled', 'archived'].includes(t.status),
        ).length,
        blockedTasks: tasks.filter((t: MetricTask) => t.status === 'blocked').length,
        awaitingReview: tasks.filter((t: MetricTask) => t.status === 'under_review').length,
        totalProjects: projects.length,
        activeProjects: projects.filter((p: MetricProject) => p.status === 'active').length,
        totalUsers: users.length,
        completionRate:
          tasks.length > 0
            ? Math.round(
                (tasks.filter((t: MetricTask) => t.status === 'completed' || t.status === 'closed')
                  .length /
                  tasks.length) *
                  100,
              )
            : 0,
        upcomingDeadlines: tasks
          .filter(
            (t: MetricTask) =>
              t.dueDate && !['completed', 'closed', 'cancelled', 'archived'].includes(t.status),
          )
          .sort(
            (a: MetricTask, b: MetricTask) =>
              new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
          )
          .slice(0, 5),
        recentActivity: tasks
          .sort(
            (a: MetricTask, b: MetricTask) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )
          .slice(0, 10),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const urgentThreshold = useMemo(() => Date.now() + 86400000 * 2, []);

  useEffect(() => {
    startTransition(() => {
      fetchMetrics();
    });
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-1">
          <div className="shimmer h-8 w-48 rounded-xl" />
          <div className="shimmer mt-2 h-4 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="border-surface-300/20 bg-surface-100/80 rounded-2xl border p-5">
              <div className="shimmer h-3 w-20 rounded-lg" />
              <div className="shimmer mt-3 h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="border-surface-300/20 bg-surface-100/80 rounded-2xl border p-6">
              <div className="shimmer h-4 w-36 rounded-lg" />
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="shimmer h-10 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in flex h-96 items-center justify-center">
        <Card className="border-error/20 w-full max-w-md">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="bg-error/10 flex h-14 w-14 items-center justify-center rounded-full">
              <AlertTriangle className="text-error h-6 w-6" />
            </div>
            <h2 className="text-surface-900 mt-4 text-lg font-semibold">
              Failed to load dashboard
            </h2>
            <p className="text-surface-500 mt-1.5 text-sm">{error}</p>
            <Button
              variant="default"
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchMetrics();
              }}
              className="mt-4"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) return null;

  const kpiCards = [
    {
      label: 'Total Tasks',
      value: metrics.totalTasks,
      icon: ListTodo,
      gradient: 'from-blue-500 to-blue-400',
      iconBg: 'bg-blue-500/10 text-blue-400',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'In Progress',
      value: metrics.inProgress,
      icon: Activity,
      gradient: 'from-amber-500 to-yellow-400',
      iconBg: 'bg-amber-500/10 text-amber-400',
      trend: null,
      trendUp: undefined,
    },
    {
      label: 'Overdue',
      value: metrics.overdueTasks,
      icon: Clock,
      gradient: 'from-red-500 to-rose-400',
      iconBg: 'bg-red-500/10 text-red-400',
      trend: '-5%',
      trendUp: true,
    },
    {
      label: 'Blocked',
      value: metrics.blockedTasks,
      icon: AlertTriangle,
      gradient: 'from-orange-500 to-amber-400',
      iconBg: 'bg-orange-500/10 text-orange-400',
      trend: null,
      trendUp: undefined,
    },
    {
      label: 'Completed',
      value: metrics.completedTasks,
      icon: CheckCircle2,
      gradient: 'from-green-500 to-emerald-400',
      iconBg: 'bg-green-500/10 text-green-400',
      trend: '+18%',
      trendUp: true,
    },
    {
      label: 'Completion Rate',
      value: `${metrics.completionRate}%`,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-violet-400',
      iconBg: 'bg-purple-500/10 text-purple-400',
      trend: null,
      trendUp: undefined,
    },
    {
      label: 'Active Projects',
      value: metrics.activeProjects,
      icon: Target,
      gradient: 'from-indigo-500 to-blue-400',
      iconBg: 'bg-indigo-500/10 text-indigo-400',
      trend: null,
      trendUp: undefined,
    },
    {
      label: 'Team Members',
      value: metrics.totalUsers,
      icon: Users,
      gradient: 'from-teal-500 to-cyan-400',
      iconBg: 'bg-teal-500/10 text-teal-400',
      trend: null,
      trendUp: undefined,
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-surface-900 text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-surface-500 mt-1 text-sm">
            Welcome back,{' '}
            <span className="text-surface-700 dark:text-surface-300 font-medium">{userName}</span>
          </p>
        </div>
        <div className="text-surface-500 flex items-center gap-2 text-xs">
          <span className="flex h-2 w-2 rounded-full bg-green-500" />
          <span>All systems operational</span>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <motion.div key={kpi.label} variants={itemVariants} custom={i}>
            <motion.div
              whileHover={{ y: -2 }}
              className="border-surface-300/20 bg-surface-100/80 hover:border-brand-500/30 group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm"
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${kpi.gradient} opacity-60`}
              />
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                    {kpi.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-surface-900 text-2xl font-bold tracking-tight">
                      {kpi.value}
                    </p>
                    {kpi.trend && (
                      <span
                        className={`flex items-center gap-0.5 text-[11px] font-medium ${kpi.trendUp ? 'text-success' : 'text-error'}`}
                      >
                        {kpi.trendUp ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {kpi.trend}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`rounded-xl p-2.5 ${kpi.iconBg} transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm`}
                >
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="border-surface-300/20 bg-surface-100/80 rounded-2xl border p-6"
              >
                <div className="shimmer h-4 w-36 rounded-lg" />
                <div className="shimmer mt-6 h-48 rounded-xl" />
              </div>
            ))}
          </div>
        }
      >
        <RechartsCharts
          donutData={[
            { name: 'Open', value: metrics.openTasks },
            { name: 'In Progress', value: metrics.inProgress },
            { name: 'Completed', value: metrics.completedTasks },
            { name: 'Blocked', value: metrics.blockedTasks },
            { name: 'Review', value: metrics.awaitingReview },
          ].filter((d) => d.value > 0)}
          barData={[
            { name: 'Overdue', value: metrics.overdueTasks, fill: '#f87171' },
            { name: 'Blocked', value: metrics.blockedTasks, fill: '#fb923c' },
            { name: 'Review', value: metrics.awaitingReview, fill: '#22d3ee' },
            { name: 'In Progress', value: metrics.inProgress, fill: '#fbbf24' },
            { name: 'Completed', value: metrics.completedTasks, fill: '#34d399' },
          ]}
          total={metrics.totalTasks || 1}
          pieColors={['#60a5fa', '#fbbf24', '#34d399', '#f87171', '#22d3ee']}
        />
      </Suspense>

      {/* Deadlines & Activity Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Clock className="text-surface-400 h-4 w-4" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.upcomingDeadlines.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="text-success/50 h-8 w-8" />
                  <p className="text-surface-500 mt-2 text-sm font-medium">All caught up!</p>
                  <p className="text-surface-500 text-xs">No upcoming deadlines</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.upcomingDeadlines.map((task, i) => {
                    const isUrgent =
                      task.dueDate && new Date(task.dueDate).getTime() < urgentThreshold;
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`group flex items-center justify-between rounded-xl border p-3 text-sm transition-all duration-200 hover:shadow-sm ${
                          isUrgent
                            ? 'border-red-500/20 bg-red-500/5'
                            : 'border-surface-300/20 bg-surface-100/50'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={`h-2 w-2 shrink-0 rounded-full ${statusDotColors[task.status] ?? 'bg-surface-400'}`}
                          />
                          <span className="text-surface-700 group-hover:text-brand-400 dark:text-surface-300 truncate transition-colors">
                            {task.title}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          <Badge variant={statusColors[task.status] ?? 'default'} size="sm">
                            {task.status.replace(/_/g, ' ')}
                          </Badge>
                          <span
                            className={`text-xs font-medium ${isUrgent ? 'text-error' : 'text-surface-500'}`}
                          >
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Activity className="text-surface-400 h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Activity className="text-surface-300 dark:text-surface-600 h-8 w-8" />
                  <p className="text-surface-500 mt-2 text-sm font-medium">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {metrics.recentActivity.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-surface-200/50 group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={`h-2 w-2 shrink-0 rounded-full ${statusDotColors[task.status] ?? 'bg-surface-400'}`}
                        />
                        <span className="text-surface-600 group-hover:text-brand-400 dark:text-surface-400 truncate transition-colors">
                          {task.title}
                        </span>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <Badge variant={statusColors[task.status] ?? 'default'} size="sm">
                          {task.status.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-surface-500 text-[11px]">
                          {new Date(task.updatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
