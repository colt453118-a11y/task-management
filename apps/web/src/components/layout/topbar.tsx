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
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { SearchCommand } from './search-command';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { KeyboardShortcutsModal, useKeyboardShortcuts } from '@/components/ui/keyboard-shortcuts';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

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

  // Register ? key for keyboard shortcuts
  useKeyboardShortcuts(shortcutsOpen, setShortcutsOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        setQuickCreateOpen(true);
      }
    }

    function handleCustomSearch() {
      setSearchOpen(true);
    }
    function handleCustomQuickCreate() {
      setQuickCreateOpen(true);
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
        setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
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
              onClick={() => setNotifOpen(!notifOpen)}
              className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 relative rounded-xl p-2 transition-all duration-200"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 flex h-2 w-2">
                <span className="bg-brand-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-brand-500 ring-surface-50 dark:ring-surface-900 relative inline-flex h-2 w-2 rounded-full ring-2" />
              </span>
            </button>

            {notifOpen && (
              <div className="animate-scale-in border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 absolute right-0 z-50 mt-2 w-72 rounded-2xl border p-3 shadow-lg backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                    Notifications
                  </span>
                  <span className="text-brand-500 hover:text-brand-400 cursor-pointer text-[10px] font-medium">
                    Mark all read
                  </span>
                </div>
                <div className="flex flex-col items-center py-8 text-center">
                  <Bell className="text-surface-400 mb-2 h-8 w-8" />
                  <p className="text-surface-500 text-sm font-medium">No notifications yet</p>
                  <p className="text-surface-500 mt-0.5 text-xs">
                    We&apos;ll let you know when something arrives
                  </p>
                </div>
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
