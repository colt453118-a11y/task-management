import { serverFetchJson } from '@/lib/api/server-fetch';
import { ReportsClient, type Snapshot } from './reports-client';
import { computeReportMetrics, type MetricTask, type MetricProject } from './metrics';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  // Seed the overview metrics on the server (computed from the same task +
  // project lists the client would fetch) so the KPI cards paint immediately.
  // The time-report tab, AI summaries, and mutations still run from the client.
  const [tasksData, projectsData, snapshotsData] = await Promise.all([
    serverFetchJson<{ tasks: MetricTask[] }>('/api/tasks'),
    serverFetchJson<{ projects: MetricProject[] }>('/api/projects'),
    serverFetchJson<{ snapshots: Snapshot[] }>('/api/reports/snapshots?limit=5'),
  ]);
  // Only seed when the primary data loaded; otherwise let the client fetch on
  // mount (null) so the page degrades gracefully.
  const initialMetrics =
    tasksData && projectsData
      ? computeReportMetrics(tasksData.tasks, projectsData.projects, Date.now())
      : null;
  return (
    <ReportsClient
      initialMetrics={initialMetrics}
      initialSnapshots={snapshotsData?.snapshots ?? []}
    />
  );
}
