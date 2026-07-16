import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { PageTransition } from '@/components/ui/page-transition';
import { ScrollToTop } from '@/components/ui/scroll-to-top';

/**
 * Dashboard layout wraps all authenticated pages.
 * Authentication is enforced by middleware.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="bg-surface-50 dark:bg-surface-950 scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
      <ScrollToTop />
    </div>
  );
}
