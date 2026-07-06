'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const projects = [
  {
    name: 'Platform Redesign',
    status: 'active',
    progress: 65,
    lead: 'You',
    tasks: { total: 24, completed: 16 },
    deadline: 'Dec 20, 2025',
  },
  {
    name: 'Mobile App v2',
    status: 'active',
    progress: 30,
    lead: 'Sarah',
    tasks: { total: 18, completed: 5 },
    deadline: 'Feb 15, 2026',
  },
  {
    name: 'API Migration',
    status: 'on_hold',
    progress: 80,
    lead: 'Mike',
    tasks: { total: 12, completed: 10 },
    deadline: 'Jan 10, 2026',
  },
  {
    name: 'Security Audit',
    status: 'completed',
    progress: 100,
    lead: 'Alex',
    tasks: { total: 8, completed: 8 },
    deadline: 'Completed',
  },
];

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  on_hold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Projects</h1>
          <p className="mt-1 text-sm text-surface-500">Manage your team&apos;s projects and milestones</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Project Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <div
            key={project.name}
            className="rounded-lg border border-surface-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-surface-700 dark:bg-surface-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-surface-900 dark:text-surface-50">{project.name}</h3>
                <span
                  className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[project.status]}`}
                >
                  {project.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-surface-500">
                <span>Progress</span>
                <span>{project.progress}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-100 dark:bg-surface-700">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-surface-100 pt-4 text-xs dark:border-surface-700">
              <div>
                <p className="text-surface-500">Lead</p>
                <p className="font-medium text-surface-900 dark:text-surface-100">{project.lead}</p>
              </div>
              <div>
                <p className="text-surface-500">Tasks</p>
                <p className="font-medium text-surface-900 dark:text-surface-100">
                  {project.tasks.completed}/{project.tasks.total}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Deadline</p>
                <p className="font-medium text-surface-900 dark:text-surface-100">{project.deadline}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
