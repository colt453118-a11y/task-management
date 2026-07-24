'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  Menu,
  Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotificationStore } from '@/stores/notification-store';
import { useScrollHide } from '@/lib/hooks/use-scroll-hide';

// ─── Navigation Items ───────────────────────────────────────────
// Limited to 5 for mobile bottom nav — most critical routes only.
// 'more' tab opens the sidebar drawer.

interface NavItem {
  label: string;
  href?: string;
  icon: typeof LayoutDashboard;
  action?: 'sidebar' | 'quick-create';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'New', icon: Plus, action: 'quick-create' },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'More', icon: Menu, action: 'sidebar' },
];

// ─── Component ──────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // ── Scroll-to-hide + shadow ───────────────────────────────
  const { elementSpring, shadowSpring, shadowParallaxSpring } = useScrollHide({
    hideOffset: 100,
  });

  const isActive = (item: NavItem): boolean => {
    if (!item.href) return false;
    if (item.href === '/') return pathname === '/';
    return pathname.startsWith(item.href);
  };

  const handleAction = (item: NavItem) => {
    if (item.action === 'sidebar') {
      window.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
    } else if (item.action === 'quick-create') {
      window.dispatchEvent(new CustomEvent('open-quick-create'));
    }
  };

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-300/20 bg-surface-50/95 backdrop-blur-xl md:hidden overflow-visible"        style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        y: elementSpring,
      }}
    >
      {/* Shadow overlay — fades in when content scrolls behind the nav */}
      {/* Light mode: black shadow */}
      <motion.div
        className="pointer-events-none absolute bottom-full left-0 right-0 h-3 dark:hidden"
        style={{
          opacity: shadowSpring,
          y: shadowParallaxSpring,
          background: 'linear-gradient(to top, rgba(0,0,0,0.12), transparent)',
        }}
      />
      {/* Dark mode: white shadow */}
      <motion.div
        className="pointer-events-none absolute bottom-full left-0 right-0 h-3 hidden dark:block"
        style={{
          opacity: shadowSpring,
          y: shadowParallaxSpring,
          background: 'linear-gradient(to top, rgba(255,255,255,0.06), transparent)',
        }}
      />
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const isMore = item.action === 'sidebar';
          const isNew = item.action === 'quick-create';

          return (
            <div key={item.label} className="relative flex-1 flex items-center justify-center">
              {item.href && !isMore ? (
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-all duration-200 min-w-0',
                    active
                      ? 'text-brand-500'
                      : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="bottomNavActiveBg"
                      className="bg-brand-500/10 absolute inset-0 rounded-xl"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative flex flex-col items-center gap-0.5">
                    <item.icon
                      className={cn(
                        'h-5 w-5 transition-all duration-200',
                        active && 'text-brand-500',
                      )}
                    />
                    {/* Label only on active tab — absolutely positioned to prevent layout shift */}
                    {active && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="absolute -bottom-3.5 whitespace-nowrap text-[10px] font-medium leading-none"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </span>
                </Link>
              ) : isNew ? (
                <button
                  onClick={() => handleAction(item)}
                  className="relative -mt-3 flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-200 text-surface-500"
                  aria-label="Quick create task"
                >
                  <div className="bg-brand-500 shadow-brand-500/30 hover:shadow-brand-500/40 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg transition-shadow duration-200 active:scale-95">
                    <Plus className="h-5 w-5" />
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => handleAction(item)}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-all duration-200',
                    'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300',
                  )}
                  aria-label={item.label}
                >
                  <span className="relative">
                    <item.icon className="h-5 w-5" />
                    {/* Notification badge on the More/Menu icon — sidebar opens notifications */}
                    {isMore && unreadCount > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1 text-[7px] font-bold text-white shadow-sm ring-1 ring-surface-50 dark:ring-surface-900">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.nav>
  );
}
