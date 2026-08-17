import { serverFetchJson } from '@/lib/api/server-fetch';
import type { Task, Comment, Attachment, TimeEntry } from '@/stores/task-store';
import { TaskDetailClient } from './task-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

// Load the task and its comments/attachments/time-entries on the server so the
// first paint has the real task, then seed the client shell from props. The
// client's Zustand store still refetches on mount (keeping it the source of
// truth for every mutation); until it resolves, the shell renders the seeded
// props. A null task payload (load failed / not found) makes the shell fall
// back to fetching and resolving the error/not-found state.
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [taskData, commentsData, attachmentsData, timeData] = await Promise.all([
    serverFetchJson<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}`),
    serverFetchJson<{ comments: Comment[] }>(`/api/tasks/${encodeURIComponent(id)}/comments`),
    serverFetchJson<{ attachments: Attachment[] }>(
      `/api/tasks/${encodeURIComponent(id)}/attachments`,
    ),
    serverFetchJson<{ entries: TimeEntry[] }>(`/api/tasks/${encodeURIComponent(id)}/time-entries`),
  ]);
  return (
    <TaskDetailClient
      initialTask={taskData?.task ?? null}
      initialComments={commentsData?.comments ?? []}
      initialAttachments={attachmentsData?.attachments ?? []}
      initialTimeEntries={timeData?.entries ?? []}
    />
  );
}
