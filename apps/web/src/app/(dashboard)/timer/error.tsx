'use client';

import { Clock } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function TimerError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<Clock className="text-error h-10 w-10" />}
      title="Time tracking error"
      description="Something went wrong while loading the time tracking view. Your other pages and navigation remain accessible."
      navHref="/timer"
      navLabel="Time Tracking"
    />
  );
}
