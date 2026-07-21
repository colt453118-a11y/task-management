'use client';

import { UserCog } from 'lucide-react';
import { DashboardSectionError } from '@/components/ui/dashboard-section-error';
import type { DashboardSectionErrorProps } from '@/components/ui/dashboard-section-error';

export default function UsersError(props: DashboardSectionErrorProps) {
  return (
    <DashboardSectionError
      {...props}
      icon={<UserCog className="text-error h-10 w-10" />}
      title="Users error"
      description="Something went wrong while loading the users section. Other parts of the application are unaffected."
      navHref="/users"
      navLabel="All users"
    />
  );
}
