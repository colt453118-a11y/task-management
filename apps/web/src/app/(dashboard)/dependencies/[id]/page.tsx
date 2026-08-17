import { serverFetchJson } from '@/lib/api/server-fetch';
import { DependencyGraphClient, type DependencyGraphData } from './dependency-graph-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function DependencyGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Load the dependency graph (primary) and the root task's title on the server
  // so the first paint has the real graph. A null graph (load failed or not
  // found) makes the client shell fetch and resolve the error/not-found state.
  const [graph, task] = await Promise.all([
    serverFetchJson<DependencyGraphData>(
      `/api/tasks/${encodeURIComponent(id)}/dependencies/deep`,
    ),
    serverFetchJson<{ task: { title: string } | null }>(
      `/api/tasks/${encodeURIComponent(id)}`,
    ),
  ]);
  return (
    <DependencyGraphClient
      initialGraph={graph}
      initialTaskTitle={task?.task?.title ?? ''}
    />
  );
}
