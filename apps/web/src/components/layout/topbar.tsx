'use client';

import { Search, Bell, User, LogOut, Settings, Keyboard, ChevronDown, Sun, Moon, Sparkles } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { SearchCommand } from './search-command';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

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
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    try { await authClient.signOut(); } catch { /* proceed */ }
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-surface-300/20 bg-surface-50/80 backdrop-blur-xl px-4 sm:px-6 sticky top-0 z-30">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full rounded-xl border border-surface-300/20 bg-surface-100/50 py-2 pl-10 pr-3 text-left text-sm text-surface-400 transition-all duration-200 hover:border-surface-400/30 hover:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800/30 dark:hover:bg-surface-700/30"
          >
            <span>Search tasks...</span>
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-surface-300/20 bg-surface-100/80 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 sm:flex dark:bg-surface-800/80">
              <span>⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Quick create + theme */}
        <div className="flex items-center gap-0.5">
          {/* Quick Create Button */}
          <button
            onClick={() => setQuickCreateOpen(true)}
            className="relative mr-0.5 flex items-center gap-1.5 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-1.5 text-xs font-medium text-brand-500 transition-all duration-200 hover:bg-brand-500/10 hover:border-brand-500/30"
            title="Quick create task (⌘T)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick</span>
            <kbd className="hidden lg:inline-flex items-center rounded border border-brand-500/20 bg-brand-500/10 px-1 py-0.5 text-[9px] font-medium">
              ⌘T
            </kbd>
          </button>

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-xl p-2 text-surface-500 transition-all duration-200 hover:bg-surface-200/70 hover:text-surface-600"
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
              className="relative rounded-xl p-2 text-surface-500 transition-all duration-200 hover:bg-surface-200/70 hover:text-surface-600"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500 ring-2 ring-surface-50 dark:ring-surface-900" />
              </span>
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 animate-scale-in rounded-2xl border border-surface-300/20 bg-surface-50/95 backdrop-blur-xl p-3 shadow-lg z-50 dark:bg-surface-900/95 dark:border-surface-700/30">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Notifications</span>
                  <span className="text-[10px] text-brand-500 font-medium cursor-pointer hover:text-brand-400">Mark all read</span>
                </div>
                <div className="flex flex-col items-center py-8 text-center">
                  <Bell className="h-8 w-8 text-surface-400 mb-2" />
                  <p className="text-sm font-medium text-surface-500">No notifications yet</p>
                  <p className="text-xs text-surface-500 mt-0.5">We&apos;ll let you know when something arrives</p>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar / Menu */}
          <div ref={userMenuRef} className="relative ml-0.5">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'flex items-center gap-2 rounded-xl p-1.5 pr-2.5 transition-all duration-200 hover:bg-surface-200/70',
                userMenuOpen && 'bg-surface-200/70'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-medium text-white shadow-sm">
                U
              </div>
              <ChevronDown className={cn('h-3.5 w-3.5 text-surface-500 transition-transform duration-200', userMenuOpen && 'rotate-180')} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 animate-scale-in rounded-2xl border border-surface-300/20 bg-surface-50/95 backdrop-blur-xl p-1.5 shadow-lg z-50 dark:bg-surface-900/95 dark:border-surface-700/30">
                <div className="px-3 py-2.5 border-b border-surface-300/20 dark:border-surface-700/30">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100">Admin User</p>
                  <p className="text-xs text-surface-500 mt-0.5">colt453118@gmail.com</p>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-surface-600 transition-colors hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800">
                    <User className="h-4 w-4" /> Profile
                  </button>
                  <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-surface-600 transition-colors hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800">
                    <Settings className="h-4 w-4" /> Settings
                  </button>
                  <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-surface-600 transition-colors hover:bg-surface-200/50 dark:text-surface-400 dark:hover:bg-surface-800">
                    <Keyboard className="h-4 w-4" /> Keyboard shortcuts
                  </button>
                </div>

                <div className="mt-1 pt-1 border-t border-surface-300/20 dark:border-surface-700/30">
                  <button onClick={handleSignOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-error transition-colors hover:bg-error/5">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <SearchCommand key={searchOpen ? 'open' : 'closed'} open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateTaskDialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
    </>
  );
}
