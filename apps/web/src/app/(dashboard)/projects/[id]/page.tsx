import { serverFetchJson } from '@/lib/api/server-fetch';
import {
  ProjectDetailClient,
  type ProjectDetail,
  type TaskStats,
} from './project-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

// Seed the project + its task stats on the server (the LCP content: name,
// status, KPI numbers). The project's task LIST is secondary and loads
// client-side on mount. A null payload (load failed / not found) makes the
// client shell fall back to fetching and resolving the error/not-found state.
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serverFetchJson<{
    project: ProjectDetail;
    taskStats: TaskStats;
    milestones: { total: number };
  }>(`/api/projects/${encodeURIComponent(id)}`);
  return (
    <ProjectDetailClient
      initialProject={data?.project ?? null}
      initialTaskStats={data?.taskStats ?? null}
      initialMilestones={data?.milestones?.total ?? 0}
    />
  );
}
