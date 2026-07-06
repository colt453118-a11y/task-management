import { cn } from '@/lib/utils';

export default function DashboardPage() {
  // TODO: Check auth and redirect to login if not authenticated
  return <DashboardContent />;
}

function DashboardContent() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Overview of your workspace
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Tasks"
          value="42"
          change="+12%"
          trend="up"
        />
        <KpiCard
          title="Due Today"
          value="8"
          change="3 overdue"
          trend="down"
        />
        <KpiCard
          title="In Progress"
          value="15"
          change="2 this week"
          trend="neutral"
        />
        <KpiCard
          title="Productivity"
          value="98%"
          change="+5%"
          trend="up"
        />
      </div>

      {/* Activity & Deadlines */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-lg border border-surface-200 bg-white p-5 dark:bg-surface-950">
          <h2 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">
            Recent Activity
          </h2>
          <div className="space-y-3">
            <ActivityItem
              user="You"
              action="completed"
              target="TASK-1042"
              time="2 hours ago"
            />
            <ActivityItem
              user="Sarah"
              action="assigned"
              target="TASK-1043"
              time="3 hours ago"
            />
            <ActivityItem
              user="Mike"
              action="commented on"
              target="TASK-1039"
              time="5 hours ago"
            />
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-lg border border-surface-200 bg-white p-5 dark:bg-surface-950">
          <h2 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">
            Upcoming Deadlines
          </h2>
          <div className="space-y-3">
            <DeadlineItem
              task="TASK-1042"
              title="Implement OAuth SSO"
              due="Tomorrow"
              priority="high"
            />
            <DeadlineItem
              task="TASK-1043"
              title="Database migration script"
              due="In 3 days"
              priority="medium"
            />
            <DeadlineItem
              task="TASK-1044"
              title="UI design review"
              due="Next week"
              priority="low"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  change,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-surface-500',
  };

  return (
    <div className="rounded-lg border border-surface-200 bg-white p-5 dark:bg-surface-950">
      <p className="text-xs font-medium text-surface-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-surface-900 dark:text-surface-50">
        {value}
      </p>
      <p className={cn('mt-1 text-xs', trendColors[trend])}>{change}</p>
    </div>
  );
}

function ActivityItem({
  user,
  action,
  target,
  time,
}: {
  user: string;
  action: string;
  target: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-surface-700 dark:text-surface-300">
        <span className="font-medium text-surface-900 dark:text-surface-50">
          {user}
        </span>{' '}
        {action}{' '}
        <span className="font-mono text-brand-600">{target}</span>
      </p>
      <span className="text-xs text-surface-400">{time}</span>
    </div>
  );
}

function DeadlineItem({
  task,
  title,
  due,
  priority,
}: {
  task: string;
  title: string;
  due: string;
  priority: 'high' | 'medium' | 'low';
}) {
  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500',
  };

  return (
    <div
      className={`border-l-2 pl-3 ${priorityColors[priority]}`}
    >
      <p className="font-mono text-xs text-brand-600">{task}</p>
      <p className="text-sm text-surface-700 dark:text-surface-300">{title}</p>
      <p className="text-xs text-surface-400">{due}</p>
    </div>
  );
}
