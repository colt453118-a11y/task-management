'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-display';
import { motion } from 'framer-motion';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp, Loader2, Camera, Download, FileText, LineChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Snapshot { id: string; snapshotDate: string; snapshotType: string; label: string | null; summary: Record<string, unknown> | null; createdAt: string; }
interface MetricTask { status: string; dueDate?: string; updatedAt: string; }
interface MetricProject { status: string; }

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } } };

export default function ReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [recentSnapshots, setRecentSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksRes, projectsRes, snapshotsRes] = await Promise.all([
          fetch('/api/tasks'), fetch('/api/projects'), fetch('/api/reports/snapshots?limit=5'),
        ]);
        if (!tasksRes.ok || !projectsRes.ok) throw new Error('Failed to fetch report data');
        const { tasks } = await tasksRes.json();
        const { projects } = await projectsRes.json();
        if (snapshotsRes.ok) { const snapData = await snapshotsRes.json(); setRecentSnapshots(snapData.snapshots ?? []); }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        setMetrics({
          totalTasks: tasks.length, open: tasks.filter((t: MetricTask) => t.status === 'open').length,
          inProgress: tasks.filter((t: MetricTask) => t.status === 'in_progress').length,
          completed: tasks.filter((t: MetricTask) => t.status === 'completed').length,
          closed: tasks.filter((t: MetricTask) => t.status === 'closed').length,
          blocked: tasks.filter((t: MetricTask) => t.status === 'blocked').length,
          overdue: tasks.filter((t: MetricTask) => t.dueDate && new Date(t.dueDate) < today && !['completed', 'closed', 'cancelled'].includes(t.status)).length,
          completedThisWeek: tasks.filter((t: MetricTask) => t.status === 'completed' && new Date(t.updatedAt) >= weekAgo).length,
          activeProjects: projects.filter((p: MetricProject) => p.status === 'active').length,
          completionRate: tasks.length > 0 ? Math.round((tasks.filter((t: MetricTask) => ['completed', 'closed'].includes(t.status)).length / tasks.length) * 100) : 0,
        });
      } catch { /* */ }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  async function handleGenerateSnapshot() {
    setGenerating(true);
    try {
      const res = await fetch('/api/reports/snapshots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `EOD Report - ${new Date().toLocaleDateString()}`, snapshotType: 'eod' }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message ?? 'Failed to generate snapshot'); }
      toast({ title: 'Snapshot generated', description: 'EOD report snapshot has been saved as an immutable record.' });
      const snapRes = await fetch('/api/reports/snapshots?limit=5');
      if (snapRes.ok) { const snapData = await snapRes.json(); setRecentSnapshots(snapData.snapshots ?? []); }
    } catch (err) { toast({ title: 'Failed to generate snapshot', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' }); }
    finally { setGenerating(false); }
  }

  async function handleExport(type: string) {
    setExporting(type);
    try {
      const res = await fetch(`/api/reports/export?type=${type}`, { method: 'GET' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message ?? 'Failed to export'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `report-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: `${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded as CSV.` });
    } catch (err) { toast({ title: 'Export failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'error' }); }
    finally { setExporting(null); }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1"><div className="h-8 w-36 shimmer rounded-xl" /><div className="mt-2 h-4 w-56 shimmer rounded-lg" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }, (_, i) => (<div key={i} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 p-4"><div className="h-3 w-16 shimmer rounded-lg" /><div className="mt-2 h-8 w-12 shimmer rounded-lg" /></div>))}
        </div>
      </div>
    );
  }

  const reportCards = [
    { label: 'Total Tasks', value: metrics.totalTasks ?? 0, icon: BarChart3, color: 'bg-blue-500/10 text-blue-400' },
    { label: 'In Progress', value: metrics.inProgress ?? 0, icon: TrendingUp, color: 'bg-amber-500/10 text-amber-400' },
    { label: 'Completed', value: metrics.completed ?? 0, icon: CheckCircle2, color: 'bg-green-500/10 text-green-400' },
    { label: 'Closed', value: metrics.closed ?? 0, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Blocked', value: metrics.blocked ?? 0, icon: AlertTriangle, color: 'bg-red-500/10 text-red-400' },
    { label: 'Overdue', value: metrics.overdue ?? 0, icon: Clock, color: 'bg-orange-500/10 text-orange-400' },
    { label: 'Completed This Week', value: metrics.completedThisWeek ?? 0, icon: TrendingUp, color: 'bg-teal-500/10 text-teal-400' },
    { label: 'Completion Rate', value: `${metrics.completionRate ?? 0}%`, icon: TrendingUp, color: 'bg-purple-500/10 text-purple-400' },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-surface-900">Reports</h1><p className="text-sm text-surface-500 mt-1">Task performance and productivity metrics</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleGenerateSnapshot} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {generating ? 'Capturing...' : 'Take Snapshot'}
          </Button>
          <div className="relative group">
            <Button variant="outline" disabled={exporting !== null}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
            {!exporting && (
              <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block min-w-[160px]">
                <div className="rounded-2xl border border-surface-300/20 bg-surface-50/95 backdrop-blur-xl p-1 shadow-lg dark:bg-surface-900/95 dark:border-surface-700/30">
                  {['tasks', 'projects', 'users'].map((type) => (
                    <button key={type} onClick={() => handleExport(type)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-surface-600 transition-colors hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800">
                      <FileText className="h-4 w-4" /> Export {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {reportCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 p-4">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-surface-500">{card.label}</p><p className="mt-1.5 text-2xl font-bold text-surface-900">{card.value}</p></div>
              <div className={`rounded-xl p-2 ${card.color}`}><card.icon className="h-4 w-4" /></div>
            </div>
          </div>
        ))}
      </motion.div>

      {recentSnapshots.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2"><Camera className="h-4 w-4 text-brand-500" /> Recent Report Snapshots</h3>
              <div className="space-y-2">
                {recentSnapshots.map((snap) => (
                  <div key={snap.id} className="flex items-center justify-between rounded-xl border border-surface-300/20 bg-surface-100/50 p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-surface-900 font-medium">{snap.label ?? `Snapshot - ${snap.snapshotDate}`}</span>
                      <span className="text-xs text-surface-500">{new Date(snap.createdAt).toLocaleString()}</span>
                    </div>
                    {snap.summary && <span className="text-xs text-surface-500">{String((snap.summary as Record<string, unknown>).totalTasks ?? '')} tasks</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {Object.keys(metrics).length === 0 && (
        <motion.div variants={itemVariants}>
          <EmptyState icon={<LineChart className="h-16 w-16 text-surface-300 dark:text-surface-600" />} title="No data available" message="Create some tasks and projects to start seeing reports." />
        </motion.div>
      )}
    </motion.div>
  );
}
