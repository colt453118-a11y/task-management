'use client';

import { useState, useCallback, useEffect, startTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useAIEODSummary } from '@/hooks/use-ai';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  BarChart3,
  Camera,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Target,
  RefreshCw,
  ArrowRight,
  FileText,
  Plus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface SnapshotMetric {
  totalTasks: number;
  completedCount: number;
  overdueCount: number;
  activeProjects: number;
  totalUsers: number;
  completionRate: number;
}

interface Snapshot {
  id: string;
  snapshotDate: string;
  snapshotType: string;
  label: string | null;
  summary: SnapshotMetric | null;
  createdAt: string;
}

// ─── Styling ─────────────────────────────────────────────────

const METRIC_CONFIG = [
  { label: 'Tasks', key: 'totalTasks' as const, gradient: 'from-blue-500 to-blue-400', iconBg: 'bg-blue-500/10 text-blue-500', icon: BarChart3 },
  { label: 'Done', key: 'completedCount' as const, gradient: 'from-green-500 to-emerald-400', iconBg: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
  { label: 'Overdue', key: 'overdueCount' as const, gradient: 'from-red-500 to-rose-400', iconBg: 'bg-red-500/10 text-red-500', icon: AlertTriangle },
  { label: 'Rate', key: 'completionRate' as const, gradient: 'from-purple-500 to-violet-400', iconBg: 'bg-purple-500/10 text-purple-500', icon: TrendingUp },
  { label: 'Projects', key: 'activeProjects' as const, gradient: 'from-indigo-500 to-blue-400', iconBg: 'bg-indigo-500/10 text-indigo-500', icon: Target },
  { label: 'Members', key: 'totalUsers' as const, gradient: 'from-teal-500 to-cyan-400', iconBg: 'bg-teal-500/10 text-teal-500', icon: Users },
] as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────

function formatMetricValue(s: SnapshotMetric, key: keyof SnapshotMetric): string {
  if (key === 'completionRate') return `${s.completionRate}%`;
  const val = s[key] ?? 0;
  return String(val);
}

function buildTasksSummary(s: SnapshotMetric): string {
  return [
    `Total tasks: ${s.totalTasks}`,
    `Completed: ${s.completedCount}`,
    `Overdue: ${s.overdueCount}`,
    `Completion rate: ${s.completionRate}%`,
    `Active projects: ${s.activeProjects}`,
    `Team members: ${s.totalUsers}`,
  ].join(', ');
}

// ─── Component ───────────────────────────────────────────────

export function EODReportWidget() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummaryGenerated, setAiSummaryGenerated] = useState(false);
  const [serverAiSummary, setServerAiSummary] = useState<string | null>(null);

  const { summary: clientAiSummary, loading: aiLoading, generateEODSummary, setSummary: setAiSummary } = useAIEODSummary();

  // Determine which AI summary to show: prefer server-side (persisted), fall back to client-generated
  const aiSummary = serverAiSummary ?? clientAiSummary;

  // ── Fetch latest snapshot ───────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/snapshots?limit=1&type=eod');
      if (!res.ok) throw new Error('Failed to fetch snapshot');
      const data = await res.json();
      const latest = data.snapshots?.[0] ?? null;
      setSnapshot(latest);

      if (latest?.summary) {
        const s = latest.summary as Record<string, unknown>;
        const storedAiSummary = s.aiSummary as string | undefined | null;

        if (storedAiSummary) {
          // Use the server-side AI summary stored in the snapshot's summary JSONB
          setServerAiSummary(storedAiSummary);
        } else if (!aiSummaryGenerated) {
          // No server-side AI summary — generate one client-side
          generateEODSummary(buildTasksSummary(s as unknown as SnapshotMetric));
          setAiSummaryGenerated(true);
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
    // Only run on mount — aiSummaryGenerated ref prevents re-fire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startTransition(() => {
      fetchSnapshot();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Take a new snapshot ─────────────────────────────────
  const handleTakeSnapshot = useCallback(async () => {
    setGenerating(true);
    setServerAiSummary(null);
    try {
      const res = await fetch('/api/reports/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `EOD Report - ${new Date().toLocaleDateString()}`,
          snapshotType: 'eod',
        }),
      });
      if (!res.ok) throw new Error('Failed to generate snapshot');
      const data = await res.json();
      const newSnap = data.snapshot;
      setSnapshot(newSnap);
      setAiSummary(null);
      setAiSummaryGenerated(false);

      // Check if server-side AI summary was already generated
      if (newSnap?.summary) {
        const s = newSnap.summary as Record<string, unknown>;
        const storedAiSummary = s.aiSummary as string | undefined | null;

        if (storedAiSummary) {
          setServerAiSummary(storedAiSummary);
        } else {
          // Generate client-side as fallback
          generateEODSummary(buildTasksSummary(s as unknown as SnapshotMetric));
          setAiSummaryGenerated(true);
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate snapshot');
    } finally {
      setGenerating(false);
    }
  }, [generateEODSummary, setAiSummary]);

  // ── Loading skeleton ────────────────────────────────────
  if (loading) {
    return (
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Camera className="text-surface-400 h-4 w-4" />
              EOD Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-1.5 rounded-xl border border-surface-300/20 p-2.5">
                    <div className="shimmer h-2 w-12 rounded-lg" />
                    <div className="shimmer h-5 w-8 rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="shimmer h-12 rounded-xl" />
              <div className="shimmer h-6 w-full rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="text-surface-400 h-4 w-4 shrink-0" />
              <span className="shrink-0">EOD Report</span>
              {snapshot && (
                <Link
                  href={`/reports/snapshots/${snapshot.id}`}
                  className="text-surface-400 hover:text-brand-500 ml-1 truncate text-[10px] font-normal transition-colors"
                  title={`View snapshot details — ${snapshot.label ?? snapshot.snapshotDate}`}
                >
                  — {new Date(snapshot.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Link>
              )}
            </div>
            <Link
              href="/reports"
              className="text-surface-400 hover:text-brand-500 flex items-center gap-1 text-[10px] font-medium transition-colors shrink-0"
            >
              <FileText className="h-3 w-3" />
              Full Reports
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && !snapshot ? (
            /* ── Error state ─────────────────────────────── */
            <div className="flex flex-col items-center py-6 text-center">
              <div className="bg-error/10 flex h-10 w-10 items-center justify-center rounded-full">
                <AlertTriangle className="text-error h-5 w-5" />
              </div>
              <p className="text-surface-500 mt-2 text-xs">{error}</p>
              <button
                onClick={() => { setLoading(true); setError(null); fetchSnapshot(); }}
                className="text-brand-400 hover:text-brand-300 mt-2 flex items-center gap-1 text-xs transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          ) : snapshot?.summary ? (
            /* ── Snapshot data ───────────────────────────── */
            <div className="space-y-3">
              {/* Compact metric grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {METRIC_CONFIG.map((metric) => {
                  const value = formatMetricValue(snapshot.summary! as SnapshotMetric, metric.key);
                  const Icon = metric.icon;
                  return (
                    <motion.div
                      key={metric.key}
                      whileHover={{ y: -1 }}
                      className="neon-card group relative overflow-hidden rounded-xl border p-2.5 transition-all duration-200 sm:p-3"
                    >
                      {/* Gradient top border */}
                      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${metric.gradient} opacity-60`} />
                      {/* Glow on hover */}
                      <div className={`absolute -inset-0.5 bg-gradient-to-r ${metric.gradient} opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-10`} />

                      <div className="relative flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-surface-500 text-[9px] font-semibold uppercase tracking-wider sm:text-[10px]">
                            {metric.label}
                          </p>
                          <p className="text-surface-900 mt-0.5 text-sm font-bold tracking-tight sm:text-base">
                            {value}
                          </p>
                        </div>
                        <div className={cn(
                          'mt-0.5 rounded-lg p-1.5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm shrink-0',
                          metric.iconBg,
                        )}>
                          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* AI Summary */}
              {aiLoading && (
                <div className="bg-surface-200/50 flex items-center gap-2 rounded-xl border border-surface-300/20 p-2.5">
                  <Loader2 className="text-brand-500 h-3.5 w-3.5 animate-spin" />
                  <span className="text-surface-500 text-xs">Generating AI summary...</span>
                </div>
              )}
              {aiSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-brand-500/5 rounded-xl border border-brand-500/20 p-3"
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="text-brand-500 h-3 w-3" />
                    <span className="text-surface-600 text-[9px] font-semibold uppercase tracking-wider">
                      AI Summary
                    </span>
                  </div>
                  <p className="text-surface-700 whitespace-pre-line text-xs leading-relaxed">
                    {aiSummary}
                  </p>
                </motion.div>
              )}

              {/* Footer: timestamp + take snapshot button */}
              <div className="flex items-center justify-between border-t border-surface-300/20 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-surface-400 text-[10px]">
                    {new Date(snapshot.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTakeSnapshot}
                  disabled={generating}
                  className="h-7 rounded-lg px-2 text-[10px]"
                >
                  {generating ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="mr-1 h-3 w-3" />
                  )}
                  {generating ? 'Saving...' : 'New Snapshot'}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Empty state — no snapshots yet ──────────── */
            <div className="flex flex-col items-center py-6 text-center">
              <div className="neon-card mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
                <Camera className="text-surface-400 h-5 w-5" />
              </div>
              <p className="text-surface-700 text-sm font-medium">
                No EOD reports yet
              </p>
              <p className="text-surface-500 mt-0.5 max-w-[200px] text-xs">
                Take your first snapshot to track daily progress at a glance
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleTakeSnapshot}
                disabled={generating}
                className="mt-3 h-8 rounded-lg px-3 text-xs"
              >
                {generating ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="mr-1 h-3.5 w-3.5" />
                )}
                Take Snapshot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
