import { getCurrentSession } from '@/lib/auth/session';
import { serverFetchJson } from '@/lib/api/server-fetch';
import {
  computeDashboardMetrics,
  type MetricTask,
  type MetricProject,
} from '@/lib/dashboard/metrics';
import { DashboardClient } from './dashboard-client';

// This page reads per-request auth (cookies/headers) and must never be
// statically cached — each user sees their own scoped metrics.
export const dynamic = 'force-dynamic';

/**
 * Load the initial dashboard metrics on the server so the first paint
 * already contains real content (no client fetch-after-mount waterfall).
 *
 * Data comes from the existing HTTP API routes (via `serverFetchJson`, which
 * forwards the caller's cookies) so the role-aware, tenant-scoped visibility
 * rules stay the single source of truth — see that helper for the rationale.
 *
 * Returns null on any failure; the client shell then falls back to its
 * own client-side fetch, so the dashboard degrades gracefully.
 */
async function loadInitialDashboard() {
  const [session, tasksData, projectsData, usersData] = await Promise.all([
    getCurrentSession(),
    serverFetchJson<{ tasks: MetricTask[] }>('/api/tasks?limit=500'),
    serverFetchJson<{ projects: MetricProject[] }>('/api/projects?limit=500'),
    serverFetchJson<{ users: unknown[] }>('/api/users?limit=500'),
  ]);

  if (!tasksData || !projectsData || !usersData) return null;

  const userName = session?.user?.name ?? 'User';
  const metrics = computeDashboardMetrics(tasksData.tasks, projectsData.projects, usersData.users, {
    myUserId: session?.user?.id ?? null,
    userName,
  });
  return { metrics, userName };
}

export default async function DashboardPage() {
  const initial = await loadInitialDashboard();
  return (
    <DashboardClient
      initialMetrics={initial?.metrics ?? null}
      initialUserName={initial?.userName ?? 'User'}
    />
  );
}
