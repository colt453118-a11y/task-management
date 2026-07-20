'use client';

import { Settings } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function SettingsError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<Settings className="text-error h-10 w-10" />}
      title="Settings error"
      description="Something went wrong while loading settings. Your sidebar navigation and other sections remain unaffected."
      navHref="/settings"
      navLabel="Settings"
    />
  );
}
