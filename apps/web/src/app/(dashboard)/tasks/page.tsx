import { serverFetchJson } from '@/lib/api/server-fetch';
import { TasksClient, type Task, type User } from './tasks-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

// The list opens with default filters (no status/priority/search, list view,
// page 0 of 25), so the server renders that first page for an immediate paint.
// Client-side filtering, pagination, and the board view refetch from the
// browser as before. A null tasks payload (server load failed) makes the
// client shell fall back to fetching on mount.
export default async function TasksPage() {
  const [tasksData, usersData] = await Promise.all([
    serverFetchJson<{ tasks: Task[]; total: number }>('/api/tasks?limit=25&offset=0'),
    serverFetchJson<{ users: User[] }>('/api/users?limit=100'),
  ]);
  return (
    <TasksClient
      initialTasks={tasksData?.tasks ?? null}
      initialTotal={tasksData?.total ?? 0}
      initialUsers={usersData?.users ?? []}
    />
  );
}
