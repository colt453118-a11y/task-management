'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListTodo, CheckCircle2, Clock, AlertTriangle, TrendingUp, Users, Target, Activity } from 'lucide-react';

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

// ─── Metric helpers ──────────────────────────────────────────────
interface MetricTask {
  status: string;
  dueDate?: string;
  updatedAt: string;
}


interface MetricProject {
  status: string;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Use high limit to get accurate counts for dashboard metrics
        const [tasksRes, projectsRes, usersRes] = await Promise.all([
          fetch('/api/tasks?limit=500'),
          fetch('/api/projects?limit=500'),
          fetch('/api/users?limit=500'),
        ]);

        if (!tasksRes.ok || !projectsRes.ok || !usersRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const { tasks } = await tasksRes.json();
        const { projects } = await projectsRes.json();
        const { users } = await usersRes.json();

        // Get current user info from session
        try {
          const sessionRes = await fetch('/api/auth/get-session');
          const sessionData = await sessionRes.json();
          if (sessionData?.user?.name) {
            setUserName(sessionData.user.name);
          }
        } catch { /* session fetch is best-effort */ }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const metrics: DashboardMetrics = {
          totalTasks: tasks.length,
          openTasks: tasks.filter((t: MetricTask) => t.status === 'open' || t.status === 'draft').length,
          inProgress: tasks.filter((t: MetricTask) => t.status === 'in_progress').length,
          completedTasks: tasks.filter((t: MetricTask) => t.status === 'completed').length,
          closedTasks: tasks.filter((t: MetricTask) => t.status === 'closed').length,
          overdueTasks: tasks.filter((t: MetricTask) => t.dueDate && new Date(t.dueDate) < today && !['completed', 'closed', 'cancelled', 'archived'].includes(t.status)).length,
          blockedTasks: tasks.filter((t: MetricTask) => t.status === 'blocked').length,
          awaitingReview: tasks.filter((t: MetricTask) => t.status === 'under_review').length,
          totalProjects: projects.length,
          activeProjects: projects.filter((p: MetricProject) => p.status === 'active').length,
          totalUsers: users.length,
          completionRate: tasks.length > 0
            ? Math.round((tasks.filter((t: MetricTask) => t.status === 'completed' || t.status === 'closed').length / tasks.length) * 100)
            : 0,
          upcomingDeadlines: tasks
            .filter((t: MetricTask) => t.dueDate && !['completed', 'closed', 'cancelled', 'archived'].includes(t.status))
            .sort((a: MetricTask, b: MetricTask) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime())
            .slice(0, 5),
          recentActivity: tasks
            .sort((a: MetricTask, b: MetricTask) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10),
        };

        setMetrics(metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-2 text-sm text-surface-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) return null;

  const kpiCards = [
    { label: 'Total Tasks', value: metrics.totalTasks, icon: ListTodo, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950' },
    { label: 'In Progress', value: metrics.inProgress, icon: Activity, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950' },
    { label: 'Completed', value: metrics.completedTasks, icon: CheckCircle2, color: 'bg-green-50 text-green-600 dark:bg-green-950' },
    { label: 'Overdue', value: metrics.overdueTasks, icon: Clock, color: 'bg-red-50 text-red-600 dark:bg-red-950' },
    { label: 'Blocked', value: metrics.blockedTasks, icon: AlertTriangle, color: 'bg-orange-50 text-orange-600 dark:bg-orange-950' },
    { label: 'Completion Rate', value: `${metrics.completionRate}%`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600 dark:bg-purple-950' },
    { label: 'Active Projects', value: metrics.activeProjects, icon: Target, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950' },
    { label: 'Team Members', value: metrics.totalUsers, icon: Users, color: 'bg-teal-50 text-teal-600 dark:bg-teal-950' },
  ];

  const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Dashboard</h1>
        <p className="text-sm text-surface-500 mt-1">Welcome back, {userName}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">{kpi.label}</p>
                  <p className="mt-1.5 text-2xl font-bold text-surface-900 dark:text-surface-50">{kpi.value}</p>
                </div>
                <div className={`rounded-lg p-2 ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-surface-400 py-4 text-center">No upcoming deadlines</p>
            ) : (
              <div className="space-y-2">
                {metrics.upcomingDeadlines.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-md border border-surface-100 p-3 text-sm hover:bg-surface-50 transition-colors dark:border-surface-800">
                    <span className="truncate text-surface-900 dark:text-surface-100">{task.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusColors[task.status] ?? 'default'}>{task.status}</Badge>
                      <span className="text-xs text-surface-400">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentActivity.length === 0 ? (
              <p className="text-sm text-surface-400 py-4 text-center">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {metrics.recentActivity.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-md border border-surface-100 p-3 text-sm hover:bg-surface-50 transition-colors dark:border-surface-800">
                    <span className="truncate text-surface-900 dark:text-surface-100">{task.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusColors[task.status] ?? 'default'}>{task.status}</Badge>
                      <span className="text-xs text-surface-400">{new Date(task.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
