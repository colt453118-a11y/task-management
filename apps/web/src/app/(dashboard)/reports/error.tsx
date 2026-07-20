'use client';

import { BarChart3 } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function ReportsError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<BarChart3 className="text-error h-10 w-10" />}
      title="Reports error"
      description="Something went wrong while loading this report. You can try again or navigate to a different section."
      navHref="/reports"
      navLabel="All reports"
    />
  );
}
