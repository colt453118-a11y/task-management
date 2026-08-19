import { serverFetchJson } from '@/lib/api/server-fetch';
import {
  GanttClient,
  type GanttProject,
  type GanttMilestone,
  type GanttTask,
} from './gantt-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function GanttPage() {
  // Seed the Gantt data on the server so the timeline paints with real content
  // immediately. Drag-reschedule, expand/collapse, and mutations still run from
  // the client. `serverNow` keeps the timeline range + today marker identical
  // between SSR and first hydration.
  const data = await serverFetchJson<{
    projects: GanttProject[];
    milestones: GanttMilestone[];
    tasks: GanttTask[];
  }>('/api/gantt/data');
  return (
    <GanttClient
      initialProjects={data?.projects ?? null}
      initialMilestones={data?.milestones ?? []}
      initialTasks={data?.tasks ?? []}
      serverNow={Date.now()}
    />
  );
}
