'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  Users,
  UserRoundCog,
  BarChart3,
  Calendar,
  Settings,
  ChevronLeft,
  Plus,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Teams', href: '/teams', icon: Users },
  { label: 'People', href: '/users', icon: UserRoundCog },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname, isMobile]);

  const sidebarContent = (
    <aside
      className={cn(
        'flex flex-col border-r border-surface-300/20 bg-surface-50/90 backdrop-blur-xl transition-all duration-300 ease-in-out h-full',
        collapsed && !isMobile ? 'w-16' : 'w-60',
        isMobile && 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-surface-300/20 px-4 shrink-0">
        {(!collapsed || isMobile) && (
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:shadow-brand-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold gradient-text">
              WorkManager
            </span>
          </Link>
        )}
        {collapsed && !isMobile && (
          <Link href="/" className="mx-auto group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm transition-all duration-200 group-hover:shadow-md">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'rounded-lg p-1.5 text-surface-500 transition-all duration-200 hover:bg-surface-200/70 hover:text-surface-600',
              collapsed && 'mx-auto',
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform duration-300', collapsed && 'rotate-180')}
            />
          </button>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-surface-500 transition-all duration-200 hover:bg-surface-200/70 hover:text-surface-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-500/10 text-brand-400 active-neon'
                  : 'text-surface-600 hover:bg-surface-200/50 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-300/10 dark:hover:text-surface-300',
              )}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <item.icon className={cn(
                'h-4 w-4 shrink-0 transition-all duration-200',
                isActive && 'text-brand-400',
                !isActive && 'group-hover:scale-110 group-hover:text-brand-400',
              )} />
              {(!collapsed || isMobile) && <span>{item.label}</span>}

              {/* Tooltip for collapsed mode */}
              {collapsed && !isMobile && (
                <span className="pointer-events-none absolute left-full ml-2 rounded-lg bg-surface-200/90 dark:bg-surface-800/90 px-2.5 py-1.5 text-xs font-medium text-surface-900 dark:text-surface-100 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 whitespace-nowrap z-50 border border-surface-300/20">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick create */}
      <div className="border-t border-surface-300/20 p-3 shrink-0">
        <Link
          href="/tasks/new"
          className={cn(
            'group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-500/20 transition-all duration-300 hover:shadow-md hover:shadow-brand-500/30 hover:from-brand-400 hover:to-brand-500 active:scale-[0.97] btn-shine',
            collapsed && !isMobile && 'px-0',
          )}
          title={collapsed && !isMobile ? 'New Task' : undefined}
        >
          <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          {(!collapsed || isMobile) && <span>New Task</span>}

          {collapsed && !isMobile && (
            <span className="pointer-events-none absolute left-full ml-2 rounded-lg bg-surface-200/90 dark:bg-surface-800/90 px-2.5 py-1.5 text-xs font-medium text-surface-900 dark:text-surface-100 opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 whitespace-nowrap z-50 border border-surface-300/20">
              New Task
            </span>
          )}
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition-all duration-200 hover:bg-brand-400 active:scale-95 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <div className="shrink-0">{sidebarContent}</div>
      )}

      {/* Mobile drawer overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-300 ease-in-out md:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebarContent}
        </div>
      )}
    </>
  );
}
