'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksRes, projectsRes] = await Promise.all([
          fetch('/api/tasks'),
          fetch('/api/projects'),
        ]);

        if (!tasksRes.ok || !projectsRes.ok) throw new Error('Failed to fetch report data');

        const { tasks } = await tasksRes.json();
        const { projects } = await projectsRes.json();

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        setMetrics({
          totalTasks: tasks.length,
          open: tasks.filter((t: any) => t.status === 'open').length,
          inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
          completed: tasks.filter((t: any) => t.status === 'completed').length,
          closed: tasks.filter((t: any) => t.status === 'closed').length,
          blocked: tasks.filter((t: any) => t.status === 'blocked').length,
          overdue: tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < today && !['completed', 'closed', 'cancelled'].includes(t.status)).length,
          completedThisWeek: tasks.filter((t: any) => t.status === 'completed' && new Date(t.updatedAt) >= weekAgo).length,
          activeProjects: projects.filter((p: any) => p.status === 'active').length,
          completionRate: tasks.length > 0 ? Math.round((tasks.filter((t: any) => ['completed', 'closed'].includes(t.status)).length / tasks.length) * 100) : 0,
        });
      } catch {
        // Metrics stay empty
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const reportCards = [
    { label: 'Total Tasks', value: metrics.totalTasks ?? 0, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
    { label: 'Open', value: metrics.open ?? 0, icon: BarChart3, color: 'bg-sky-50 text-sky-600' },
    { label: 'In Progress', value: metrics.inProgress ?? 0, icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
    { label: 'Completed', value: metrics.completed ?? 0, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
    { label: 'Closed', value: metrics.closed ?? 0, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Blocked', value: metrics.blocked ?? 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'Overdue', value: metrics.overdue ?? 0, icon: Clock, color: 'bg-orange-50 text-orange-600' },
    { label: 'Completed This Week', value: metrics.completedThisWeek ?? 0, icon: TrendingUp, color: 'bg-teal-50 text-teal-600' },
    { label: 'Active Projects', value: metrics.activeProjects ?? 0, icon: BarChart3, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Completion Rate', value: `${metrics.completionRate ?? 0}%`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Reports</h1>
        <p className="text-sm text-surface-500 mt-1">Task performance and productivity metrics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {reportCards.map((card) => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">{card.label}</p>
                  <p className="mt-1.5 text-2xl font-bold text-surface-900 dark:text-surface-50">{card.value}</p>
                </div>
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(metrics).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-surface-400">
            No data available yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
