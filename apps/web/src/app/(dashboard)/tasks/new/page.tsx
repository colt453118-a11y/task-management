import { serverFetchJson } from '@/lib/api/server-fetch';
import { NewTaskClient, type User, type Project } from './new-task-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
  // Load the assignee + project options on the server so the form paints
  // ready-to-use. A null result (load failed) makes the client shell fetch
  // them itself — both lists are non-critical, so the form still works.
  const [usersData, projectsData] = await Promise.all([
    serverFetchJson<{ users: User[] }>('/api/users?limit=100'),
    serverFetchJson<{ projects: Project[] }>('/api/projects?limit=100'),
  ]);
  return (
    <NewTaskClient
      initialUsers={usersData?.users ?? null}
      initialProjects={projectsData?.projects ?? null}
    />
  );
}
