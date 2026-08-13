import { headers } from 'next/headers';
import { getCurrentSession } from '@/lib/auth/session';
import { computeDashboardMetrics } from '@/lib/dashboard/metrics';
import { DashboardClient } from './dashboard-client';

// This page reads per-request auth (cookies/headers) and must never be
// statically cached — each user sees their own scoped metrics.
export const dynamic = 'force-dynamic';

/**
 * Load the initial dashboard metrics on the server so the first paint
 * already contains real content (no client fetch-after-mount waterfall).
 *
 * We deliberately call the existing HTTP API routes (with the caller's
 * cookies forwarded) rather than querying the database directly: the
 * routes carry the role-aware, tenant-scoped visibility rules
 * (task:view vs task:view_all, assigned/created/mentioned filtering).
 * Reusing them keeps a single source of truth for authorization and
 * avoids the kind of divergence that leaks another tenant's data.
 *
 * Returns null on any failure; the client shell then falls back to its
 * own client-side fetch, so the dashboard degrades gracefully.
 */
async function loadInitialDashboard() {
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    if (!cookie) return null;

    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) return null;
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const base = `${proto}://${host}`;
    const init = { headers: { cookie }, cache: 'no-store' as const };

    const [session, tasksRes, projectsRes, usersRes] = await Promise.all([
      getCurrentSession(),
      fetch(`${base}/api/tasks?limit=500`, init),
      fetch(`${base}/api/projects?limit=500`, init),
      fetch(`${base}/api/users?limit=500`, init),
    ]);

    if (!tasksRes.ok || !projectsRes.ok || !usersRes.ok) return null;

    const [{ tasks }, { projects }, { users }] = await Promise.all([
      tasksRes.json(),
      projectsRes.json(),
      usersRes.json(),
    ]);

    const userName = session?.user?.name ?? 'User';
    const metrics = computeDashboardMetrics(tasks, projects, users, {
      myUserId: session?.user?.id ?? null,
      userName,
    });
    return { metrics, userName };
  } catch {
    return null;
  }
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
