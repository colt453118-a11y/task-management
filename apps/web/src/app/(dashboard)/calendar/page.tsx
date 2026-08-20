import { serverFetchJson } from '@/lib/api/server-fetch';
import { CalendarClient, type Task, type Milestone } from './calendar-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  // Seed tasks + milestones on the server so the month grid paints with real
  // content immediately. Navigation, drag-reschedule, and mutations still run
  // from the client. `serverNow` keeps the current-month view + today highlight
  // identical between SSR and first hydration.
  const [tasksData, milestonesData] = await Promise.all([
    serverFetchJson<{ tasks: Task[] }>('/api/tasks'),
    serverFetchJson<{ milestones: Milestone[] }>('/api/milestones'),
  ]);
  return (
    <CalendarClient
      initialTasks={tasksData?.tasks ?? null}
      initialMilestones={milestonesData?.milestones ?? []}
      serverNow={Date.now()}
    />
  );
}
