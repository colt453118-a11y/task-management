import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

/**
 * Dashboard layout wraps all authenticated pages.
 * Authentication is enforced by proxy (Phase 0 cookie fix).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-surface-50 p-6 dark:bg-surface-950">
          {children}
        </main>
      </div>
    </div>
  );
}
