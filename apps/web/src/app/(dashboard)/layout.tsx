import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { PageTransition } from '@/components/ui/page-transition';
import { ScrollToTop } from '@/components/ui/scroll-to-top';
import { ErrorBoundary } from '@/components/ui/error-boundary';

/**
 * Dashboard layout wraps all authenticated pages.
 * Authentication is enforced by middleware.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip link — first focusable element; lets keyboard/SR users bypass the nav */}
      <a
        href="#main-content"
        className="focus:bg-brand-500 sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main
          id="main-content"
          tabIndex={-1}
          className="scrollbar-thin flex-1 overflow-y-auto bg-transparent p-4 pb-20 focus:outline-none sm:p-6 sm:pb-6 lg:p-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            <ErrorBoundary>
              <PageTransition>{children}</PageTransition>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <ScrollToTop />
    </div>
  );
}
