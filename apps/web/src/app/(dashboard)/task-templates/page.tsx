import { serverFetchJson } from '@/lib/api/server-fetch';
import { TaskTemplatesClient, type TaskTemplate } from './task-templates-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function TaskTemplatesPage() {
  // Load templates on the server so the first paint has real content instead of
  // a shimmer + client fetch-after-mount. Falls back to client fetching when the
  // server load fails (returns null).
  const data = await serverFetchJson<{ templates: TaskTemplate[] }>('/api/task-templates');
  return <TaskTemplatesClient initialTemplates={data?.templates ?? null} />;
}
