'use client';

import { FolderKanban } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function ProjectsError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<FolderKanban className="text-error h-10 w-10" />}
      title="Projects error"
      description="Something went wrong while loading this project view. Your navigation and other sections are still available."
      navHref="/projects"
      navLabel="All projects"
    />
  );
}
