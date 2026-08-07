'use client';

import {
  Search,
  Bell,
  User,
  LogOut,
  Settings,
  Keyboard,
  ChevronDown,
  Sparkles,
  X,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useEffect, useState, useRef, startTransition, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SearchCommand } from './search-command';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { KeyboardShortcutsModal, useKeyboardShortcuts } from '@/components/ui/keyboard-shortcuts';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notification-store';
import { useNotificationSSE } from '@/lib/hooks/use-notification-sse';
import { useScrollHide } from '@/lib/hooks/use-scroll-hide';
import Link from 'next/link';

/** Relative time string for notification timestamps. */
function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Map notification type to a display label. */
function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    'task.assigned': 'Assigned',
    'task.comment': 'New comment',
    'task.mention': 'Mentioned',
    'task.due_soon': 'Due soon',
    'task.overdue': 'Overdue',
    'task.approval_needed': 'Approval needed',
    'task.completed': 'Completed',
    'task.closed': 'Closed',
    'task.reopened': 'Reopened',
    'task.escalated': 'Escalated',
  };
  return labels[type] ?? type;
}

export function Topbar() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Scroll-to-hide + shadow (mobile only) ────────────────
  const { elementSpring, shadowSpring, shadowParallaxSpring } = useScrollHide({
    hideOffset: -60,
    mobileOnly: true,
  });

  // Notification store
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loading = useNotificationStore((s) => s.loading);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const dismiss = useNotificationStore((s) => s.dismiss);

  // Subscribe to real-time SSE notifications
  useNotificationSSE();

  // Fetch notifications on mount
  const refreshNotifs = useCallback(() => {
    fetchNotifications({ limit: 20 });
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    refreshNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register ? key for keyboard shortcuts
  useKeyboardShortcuts(shortcutsOpen, setShortcutsOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        startTransition(() => setSearchOpen(true));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        startTransition(() => setQuickCreateOpen(true));
      }
    }

    function handleCustomSearch() {
      startTransition(() => setSearchOpen(true));
    }
    function handleCustomQuickCreate() {
      startTransition(() => setQuickCreateOpen(true));
    }
    function handleCustomShortcuts() {
      startTransition(() => setShortcutsOpen(true));
    }

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-search', handleCustomSearch);
    window.addEventListener('open-quick-create', handleCustomQuickCreate);
    window.addEventListener('open-shortcuts', handleCustomShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-search', handleCustomSearch);
      window.removeEventListener('open-quick-create', handleCustomQuickCreate);
      window.removeEventListener('open-shortcuts', handleCustomShortcuts);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        startTransition(() => setUserMenuOpen(false));
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        startTransition(() => setNotifOpen(false));
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    try {
      await authClient.signOut();
    } catch {
      /* proceed */
    }
    router.push('/auth/login');
    router.refresh();
  }

  const handleNotifClick = async (notif: (typeof notifications)[0]) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      setNotifOpen(false);
      router.push(notif.link);
    }
  };

  return (
    <>
      <motion.header
        className="border-surface-500/15 bg-surface-100/70 sticky top-0 z-30 flex h-12 sm:h-14 items-center justify-between border-b px-3 backdrop-blur-xl sm:px-6"
        style={{
          y: elementSpring,
        }}
      >
        {/* Shadow overlay — fades in when content scrolls behind the header */}
        {/* Light mode: black shadow */}
        <motion.div
          className="pointer-events-none absolute top-full left-0 right-0 h-3 dark:hidden"
          style={{
            opacity: shadowSpring,
            y: shadowParallaxSpring,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.10), transparent)',
          }}
        />
        {/* Dark mode: white shadow */}
        <motion.div
          className="pointer-events-none absolute top-full left-0 right-0 h-3 hidden dark:block"
          style={{
            opacity: shadowSpring,
            y: shadowParallaxSpring,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)',
          }}
        />
        {/* Search */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="text-surface-400 absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 sm:h-4 sm:w-4 sm:left-3.5" />
          <button
            onClick={() => setSearchOpen(true)}
            className="border-surface-500/25 bg-surface-100/60 text-surface-400 hover:border-brand-500/30 hover:text-surface-500 focus:ring-brand-500/20 dark:bg-surface-800/40 dark:hover:bg-surface-700/40 w-full rounded-xl border py-1.5 pl-8 pr-2 text-left text-xs transition-all duration-200 focus:outline-none focus:ring-2 sm:py-2 sm:pl-10 sm:pr-3 sm:text-sm shadow-sm shadow-brand-500/5"
          >
            <span className="hidden sm:inline">Search tasks...</span>
            <span className="sm:hidden">Search...</span>
            <kbd className="border-surface-500/20 bg-surface-200/80 text-surface-500 dark:bg-surface-700/80 dark:border-surface-600/30 neon-card pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10px] font-medium sm:flex">
              <span>⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Quick create + theme */}
        <div className="flex items-center gap-0 sm:gap-0.5">
          {/* Quick Create Button */}
          <button
            onClick={() => setQuickCreateOpen(true)}
            className="border-brand-500/20 bg-brand-500/5 text-brand-500 hover:bg-brand-500/10 hover:border-brand-500/30 relative mr-0.5 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 shadow-sm shadow-brand-500/10"
            title="Quick create task (⌘T)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick</span>
            <kbd className="border-brand-500/20 bg-brand-500/10 hidden items-center rounded border px-1 py-0.5 text-[9px] font-medium md:inline-flex">
              ⌘T
            </kbd>
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                if (!notifOpen) refreshNotifs();
              }}
              className="text-surface-500 hover:bg-surface-200/70 dark:hover:bg-surface-700/40 hover:text-surface-600 relative rounded-xl p-2 transition-all duration-200"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-surface-50 dark:ring-surface-900">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {unreadCount === 0 && (
                <span className="absolute right-2 top-2 flex h-2 w-2">
                  <span className="bg-surface-400 relative inline-flex h-2 w-2 rounded-full" />
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="animate-scale-in border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 absolute right-0 z-50 mt-2 w-72 rounded-2xl border p-3 shadow-lg backdrop-blur-xl sm:w-80" style={{ maxWidth: 'calc(100vw - 16px)' }}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="text-surface-400 ml-1 font-normal">
                        ({unreadCount})
                      </span>
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-brand-500 hover:text-brand-400 flex items-center gap-1 text-[10px] font-medium transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {loading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-surface-400 h-5 w-5 animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Bell className="text-surface-400 mb-2 h-8 w-8" />
                    <p className="text-surface-500 text-sm font-medium">No notifications yet</p>
                    <p className="text-surface-500 mt-0.5 text-xs">
                      We&apos;ll let you know when something arrives
                    </p>
                  </div>
                ) : (
                  <div className="scrollbar-thin -mx-1 max-h-80 space-y-0.5 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={cn(
                          'group relative flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition-all duration-150',
                          notif.isRead
                            ? 'hover:bg-surface-100/80 dark:hover:bg-surface-800/50'
                            : 'bg-brand-500/5 hover:bg-brand-500/10',
                        )}
                        onClick={() => handleNotifClick(notif)}
                      >
                        {/* Unread indicator */}
                        {!notif.isRead && (
                          <span className="bg-brand-500 dark:bg-brand-400 mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                        )}
                        {notif.isRead && <span className="mt-1.5 h-2 w-2 shrink-0" />}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-surface-500 text-[10px] font-medium uppercase tracking-wider">
                              {typeLabel(notif.type)}
                            </span>
                            <span className="text-surface-400 ml-auto whitespace-nowrap text-[10px]">
                              {timeAgo(notif.createdAt)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'mt-0.5 text-sm leading-snug',
                              notif.isRead
                                ? 'text-surface-600 dark:text-surface-400'
                                : 'text-surface-900 dark:text-surface-100 font-medium',
                            )}
                          >
                            {notif.title}
                          </p>
                          {notif.message && (
                            <p className="text-surface-500 mt-0.5 line-clamp-2 text-xs">
                              {notif.message}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            {notif.link && (
                              <Link
                                href={notif.link}
                                onClick={(e) => e.stopPropagation()}
                                className="text-brand-500 hover:text-brand-400 inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors"
                              >
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Dismiss button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(notif.id);
                          }}
                          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {notifications.length > 0 && (
                  <Link
                    href="/settings"
                    onClick={() => setNotifOpen(false)}
                    className="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mt-2 flex items-center justify-center gap-1 border-t border-surface-300/20 pt-2 text-[11px] font-medium transition-colors"
                  >
                    <Settings className="h-3 w-3" />
                    Notification settings
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* User Avatar / Menu */}
          <div ref={userMenuRef} className="relative ml-0.5">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'hover:bg-surface-200/70 flex items-center gap-2 rounded-xl p-1.5 pr-2.5 transition-all duration-200',
                userMenuOpen && 'bg-surface-200/70',
              )}
            >
              <div className="from-brand-400 to-brand-600 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-sm font-medium text-white shadow-sm">
                U
              </div>
              <ChevronDown
                className={cn(
                  'text-surface-500 h-3.5 w-3.5 transition-transform duration-200',
                  userMenuOpen && 'rotate-180',
                )}
              />
            </button>

            {userMenuOpen && (
              <div className="animate-scale-in border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 absolute right-0 z-50 mt-2 min-w-[200px] rounded-2xl border p-1.5 shadow-lg backdrop-blur-xl sm:w-56">
                <div className="border-surface-300/20 dark:border-surface-700/30 border-b px-3 py-2.5">
                  <p className="text-surface-900 dark:text-surface-100 text-sm font-medium">
                    Admin User
                  </p>
                  <p className="text-surface-500 mt-0.5 text-xs">colt453118@gmail.com</p>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button className="text-surface-600 hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors">
                    <User className="h-4 w-4" /> Profile
                  </button>
                  <button className="text-surface-600 hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors">
                    <Settings className="h-4 w-4" /> Settings
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShortcutsOpen(true);
                    }}
                    className="text-surface-600 hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors"
                  >
                    <Keyboard className="h-4 w-4" /> Keyboard shortcuts
                  </button>
                </div>

                <div className="border-surface-300/20 dark:border-surface-700/30 mt-1 border-t pt-1">
                  <button
                    onClick={handleSignOut}
                    className="text-error hover:bg-error/5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Palette resets its own state (query/selection) on every open — no
          remount key needed, which keeps the dialog's close animation intact. */}
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateTaskDialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
