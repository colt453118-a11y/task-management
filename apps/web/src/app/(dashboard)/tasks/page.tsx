'use client';

import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'under_review' | 'completed';

const tasks = [
  { id: 'TASK-1042', title: 'Implement OAuth SSO', status: 'in_progress' as const, priority: 'high', assignee: 'You', due: 'Tomorrow' },
  { id: 'TASK-1043', title: 'Database migration script', status: 'open' as const, priority: 'medium', assignee: 'Sarah', due: 'In 3 days' },
  { id: 'TASK-1044', title: 'UI design review', status: 'under_review' as const, priority: 'low', assignee: 'Mike', due: 'Next week' },
  { id: 'TASK-1045', title: 'API rate limiting', status: 'blocked' as const, priority: 'urgent', assignee: 'Alex', due: 'Today' },
  { id: 'TASK-1046', title: 'Fix login page responsive', status: 'completed' as const, priority: 'medium', assignee: 'You', due: 'Done' },
];

const statusColors: Record<TaskStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  under_review: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const statusLabels: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  under_review: 'Under Review',
  completed: 'Completed',
};

export default function TasksPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Tasks</h1>
          <p className="mt-1 text-sm text-surface-500">Manage and track your team&apos;s tasks</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="search"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-surface-200 bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-700 dark:bg-surface-900"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Task Table */}
      <div className="rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="px-4 py-3 text-left font-medium text-surface-500">Task</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Assignee</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-surface-100 transition-colors hover:bg-surface-50 last:border-0 dark:border-surface-800 dark:hover:bg-surface-800"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-mono text-xs text-brand-600">{task.id}</span>
                      <p className="text-surface-900 dark:text-surface-100">{task.title}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[task.status]}`}>
                      {statusLabels[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm capitalize text-surface-600 dark:text-surface-400">{task.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{task.assignee}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{task.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
