'use client';

import { CalendarDays } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function CalendarError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<CalendarDays className="text-error h-10 w-10" />}
      title="Calendar error"
      description="Something went wrong while loading the calendar. Your other views are still accessible from the sidebar."
      navHref="/calendar"
      navLabel="Calendar"
    />
  );
}
