import { serverFetchJson } from '@/lib/api/server-fetch';
import type { Task } from '@/stores/task-store';
import { TaskDetailClient } from './task-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

// Seed only the primary task on the server — it holds the LCP content (title,
// status, description). Comments/attachments/time-entries stay client-loaded
// via the Zustand store on mount (as they were before this conversion), so the
// server render blocks on a single fetch and the detail route stays fast to
// navigate to. The store remains the source of truth for every mutation. A null
// task payload (load failed / not found) makes the shell fall back to fetching
// and resolving the error/not-found state.
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const taskData = await serverFetchJson<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}`);
  return (
    <TaskDetailClient
      initialTask={taskData?.task ?? null}
      initialComments={[]}
      initialAttachments={[]}
      initialTimeEntries={[]}
    />
  );
}
