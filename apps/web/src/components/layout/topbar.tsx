'use client';

import {
  Search,
  Bell,
  User,
  LogOut,
  Settings,
  Keyboard,
  ChevronDown,
  Sun,
  Moon,
  Sparkles,
  X,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useEffect, useState, useRef, startTransition, useCallback } from 'react';
import { SearchCommand } from './search-command';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { KeyboardShortcutsModal, useKeyboardShortcuts } from '@/components/ui/keyboard-shortcuts';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useNotificationStore } from '@/stores/notification-store';
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Notification store
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loading = useNotificationStore((s) => s.loading);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const dismiss = useNotificationStore((s) => s.dismiss);

  // Fetch notifications on mount and periodically
  const refreshNotifs = useCallback(() => {
    fetchNotifications({ limit: 20 });
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    startTransition(() => setMounted(true));
    refreshNotifs();

    // Poll every 30s for new notifications
    const interval = setInterval(refreshNotifs, 30_000);
    return () => clearInterval(interval);
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

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-search', handleCustomSearch);
    window.addEventListener('open-quick-create', handleCustomQuickCreate);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-search', handleCustomSearch);
      window.removeEventListener('open-quick-create', handleCustomQuickCreate);
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
      <header className="border-surface-300/20 bg-surface-50/80 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur-xl sm:px-6">
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="text-surface-400 absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <button
            onClick={() => setSearchOpen(true)}
            className="border-surface-300/20 bg-surface-100/50 text-surface-400 hover:border-surface-400/30 hover:text-surface-500 focus:ring-brand-500/20 dark:bg-surface-800/30 dark:hover:bg-surface-700/30 w-full rounded-xl border py-2 pl-10 pr-3 text-left text-sm transition-all duration-200 focus:outline-none focus:ring-2"
          >
            <span>Search tasks...</span>
            <kbd className="border-surface-300/20 bg-surface-100/80 text-surface-500 dark:bg-surface-800/80 pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium sm:flex">
              <span>⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Quick create + theme */}
        <div className="flex items-center gap-0.5">
          {/* Quick Create Button */}
          <button
            onClick={() => setQuickCreateOpen(true)}
            className="border-brand-500/20 bg-brand-500/5 text-brand-500 hover:bg-brand-500/10 hover:border-brand-500/30 relative mr-0.5 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200"
            title="Quick create task (⌘T)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick</span>
            <kbd className="border-brand-500/20 bg-brand-500/10 hidden items-center rounded border px-1 py-0.5 text-[9px] font-medium lg:inline-flex">
              ⌘T
            </kbd>
          </button>

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-xl p-2 transition-all duration-200"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 transition-all duration-300 hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 transition-all duration-300 hover:-rotate-12" />
              )}
            </button>
          )}

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                if (!notifOpen) refreshNotifs();
              }}
              className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 relative rounded-xl p-2 transition-all duration-200"
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
              <div className="animate-scale-in border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 absolute right-0 z-50 mt-2 w-80 rounded-2xl border p-3 shadow-lg backdrop-blur-xl">
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
              <div className="animate-scale-in border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 absolute right-0 z-50 mt-2 w-56 rounded-2xl border p-1.5 shadow-lg backdrop-blur-xl">
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
      </header>

      <SearchCommand
        key={searchOpen ? 'open' : 'closed'}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
      <CreateTaskDialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
