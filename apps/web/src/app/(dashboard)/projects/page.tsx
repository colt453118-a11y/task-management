import { serverFetchJson } from '@/lib/api/server-fetch';
import { ProjectsClient, type Project } from './projects-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  // Load the project list on the server so the first paint has real content
  // instead of a shimmer + client fetch-after-mount. Falls back to client
  // fetching when the server load fails (returns null).
  const data = await serverFetchJson<{ projects: Project[] }>('/api/projects');
  return <ProjectsClient initialProjects={data?.projects ?? null} />;
}
