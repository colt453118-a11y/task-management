'use client';

import { ListTodo } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function TasksError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<ListTodo className="text-error h-10 w-10" />}
      title="Task section error"
      description="Something went wrong while loading this task view. Your other tasks and navigation are still accessible."
      navHref="/tasks"
      navLabel="All tasks"
    />
  );
}
