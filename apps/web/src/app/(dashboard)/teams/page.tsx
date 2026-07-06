'use client';

import { Plus, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const teams = [
  {
    name: 'Core Platform',
    department: 'Engineering',
    members: 8,
    lead: 'You',
    description: 'Core platform infrastructure and services',
  },
  {
    name: 'Frontend',
    department: 'Engineering',
    members: 6,
    lead: 'Sarah',
    description: 'Web application and UI development',
  },
  {
    name: 'Backend',
    department: 'Engineering',
    members: 5,
    lead: 'Mike',
    description: 'API and service development',
  },
  {
    name: 'Design',
    department: 'Design',
    members: 4,
    lead: 'Emma',
    description: 'Product design and user experience',
  },
];

const departments = [
  { name: 'Engineering', count: 19, head: 'You' },
  { name: 'Design', count: 4, head: 'Emma' },
  { name: 'Product', count: 3, head: 'Alex' },
];

export default function TeamsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Teams</h1>
          <p className="mt-1 text-sm text-surface-500">Manage departments, teams, and members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Building2 className="mr-2 h-4 w-4" />
            Department
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Team
          </Button>
        </div>
      </div>

      {/* Departments */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-surface-500 uppercase tracking-wider">Departments</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {departments.map((dept) => (
            <div
              key={dept.name}
              className="rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50">{dept.name}</h3>
                  <p className="text-xs text-surface-500">{dept.count} members</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-surface-500">
                Head: <span className="font-medium text-surface-700 dark:text-surface-300">{dept.head}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Teams */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-surface-500 uppercase tracking-wider">Teams</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div
              key={team.name}
              className="rounded-lg border border-surface-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50">{team.name}</h3>
                    <p className="text-xs text-surface-500">{team.department}</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-surface-600 dark:text-surface-400">{team.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-surface-500">
                <span>{team.members} members</span>
                <span>Lead: <span className="font-medium text-surface-700 dark:text-surface-300">{team.lead}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
