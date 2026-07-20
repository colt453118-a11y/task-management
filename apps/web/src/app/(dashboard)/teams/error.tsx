'use client';

import { Users } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function TeamsError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<Users className="text-error h-10 w-10" />}
      title="Teams & departments error"
      description="Something went wrong while loading this team view. Other pages and navigation remain accessible."
      navHref="/teams"
      navLabel="All teams"
    />
  );
}
