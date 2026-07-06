'use client';

import { BarChart3, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Reports</h1>
          <p className="mt-1 text-sm text-surface-500">Analytics and reporting dashboards</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Date Range
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportCard
          title="Task Completion"
          description="Track task completion rates and trends"
          metric="87%"
          subtitle="This quarter"
          trend="up"
        />
        <ReportCard
          title="Team Velocity"
          description="Sprint velocity and capacity planning"
          metric="42 pts"
          subtitle="Current sprint"
          trend="up"
        />
        <ReportCard
          title="Overdue Tasks"
          description="Tasks past their deadline"
          metric="8"
          subtitle="Across all projects"
          trend="down"
        />
        <ReportCard
          title="Project Health"
          description="Overall project status distribution"
          metric="3 / 5"
          subtitle="Active projects"
          trend="neutral"
        />
        <ReportCard
          title="Time Tracking"
          description="Logged hours and utilization"
          metric="128h"
          subtitle="This week"
          trend="up"
        />
        <ReportCard
          title="Bug Rate"
          description="Bugs reported vs resolved"
          metric="12"
          subtitle="Open bugs"
          trend="down"
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  description,
  metric,
  subtitle,
  trend,
}: {
  title: string;
  description: string;
  metric: string;
  subtitle: string;
  trend: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-surface-500',
  };

  return (
    <div className="rounded-lg border border-surface-200 bg-white p-5 transition-shadow hover:shadow-sm dark:border-surface-700 dark:bg-surface-900">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>
      <h3 className="mt-4 font-semibold text-surface-900 dark:text-surface-50">{title}</h3>
      <p className="mt-1 text-xs text-surface-500">{description}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-surface-900 dark:text-surface-50">{metric}</span>
        <span className={`text-xs font-medium ${trendColors[trend]}`}>{subtitle}</span>
      </div>
    </div>
  );
}
