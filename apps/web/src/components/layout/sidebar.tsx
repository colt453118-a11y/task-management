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
  Clock,
  FileEdit,
} from 'lucide-react';
import { useState, useEffect, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Teams', href: '/teams', icon: Users },
  { label: 'People', href: '/users', icon: UserRoundCog },
  { label: 'Time Tracking', href: '/timer', icon: Clock },
  { label: 'Corrections', href: '/corrections', icon: FileEdit },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const sidebarItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 120,
      damping: 20,
      delay: i * 0.03,
    },
  }),
};

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const check = () => startTransition(() => setIsMobile(window.innerWidth < 768));
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) startTransition(() => setMobileOpen(false));
  }, [pathname, isMobile]);

  const sidebarContent = (
    <aside
      className={cn(
        'border-surface-300/20 bg-surface-50/90 flex h-full flex-col border-r backdrop-blur-xl transition-all duration-300 ease-in-out',
        collapsed && !isMobile ? 'w-16' : 'w-60',
        isMobile && 'w-60',
      )}
    >
      {/* Logo */}
      <div className="border-surface-300/20 flex h-14 shrink-0 items-center justify-between border-b px-4">
        {(!collapsed || isMobile) && (
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="from-brand-400 to-brand-600 group-hover:shadow-brand-500/20 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm transition-all duration-200 group-hover:shadow-md">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="gradient-text text-sm font-bold">WorkManager</span>
          </Link>
        )}
        {collapsed && !isMobile && (
          <Link href="/" className="group mx-auto">
            <div className="from-brand-400 to-brand-600 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm transition-all duration-200 group-hover:shadow-md">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg p-1.5 transition-all duration-200',
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
            className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg p-1.5 transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item, index) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const isHovered = hoveredItem === item.href;

          return (
            <motion.div
              key={item.href}
              custom={index}
              variants={sidebarItemVariants}
              initial="hidden"
              animate="visible"
            >
              <Link
                href={item.href}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-brand-500/10 text-brand-400 active-neon'
                    : 'text-surface-600 hover:bg-surface-200/50 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-300/10 dark:hover:text-surface-300',
                )}
                title={collapsed && !isMobile ? item.label : undefined}
              >
                <div className="relative">
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-all duration-200',
                      isActive && 'text-brand-400',
                      !isActive && 'group-hover:text-brand-400 group-hover:scale-110',
                    )}
                  />
                  {/* Ripple dot for active */}
                  {isActive && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-1.5 w-1.5">
                      <span className="bg-brand-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                      <span className="bg-brand-500 relative inline-flex h-1.5 w-1.5 rounded-full" />
                    </span>
                  )}
                </div>
                {(!collapsed || isMobile) && (
                  <span className="relative">
                    {item.label}
                    {/* Active indicator underline */}
                    {isActive && (
                      <motion.span
                        layoutId="activeNavIndicator"
                        className="bg-brand-500 absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </span>
                )}

                {/* Subtle glow on hover for active items */}
                {isActive && isHovered && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-brand-500/5 absolute inset-0 rounded-xl"
                  />
                )}

                {/* Tooltip for collapsed mode */}
                {collapsed && !isMobile && (
                  <span className="bg-surface-200/90 dark:bg-surface-800/90 text-surface-900 dark:text-surface-100 border-surface-300/20 pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Quick create */}
      <div className="border-surface-300/20 shrink-0 border-t p-3">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-quick-create'))}
          className={cn(
            'from-brand-500 to-brand-600 shadow-brand-500/20 hover:shadow-brand-500/30 hover:from-brand-400 hover:to-brand-500 btn-shine group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.97]',
            collapsed && !isMobile && 'px-0',
          )}
          title={collapsed && !isMobile ? 'New Task (⌘T)' : undefined}
        >
          {/* Animated shimmer background on hover */}
          <span className="absolute inset-0 -translate-x-full animate-none bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          {(!collapsed || isMobile) && <span>New Task</span>}

          {collapsed && !isMobile && (
            <span className="bg-surface-200/90 dark:bg-surface-800/90 text-surface-900 dark:text-surface-100 border-surface-300/20 pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:opacity-100">
              New Task (⌘T)
            </span>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile menu button - with glow pulse */}
      {isMobile && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setMobileOpen(true)}
          className="bg-brand-500 shadow-brand-500/30 hover:shadow-brand-500/40 fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg transition-shadow duration-200 hover:shadow-xl md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
          <span className="animate-glow-pulse absolute inset-0 rounded-2xl" />
        </motion.button>
      )}

      {/* Desktop sidebar */}
      {!isMobile && <div className="shrink-0">{sidebarContent}</div>}

      {/* Mobile drawer overlay */}
      {isMobile && (
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}
        </AnimatePresence>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-60 md:hidden"
            >
              {sidebarContent}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
