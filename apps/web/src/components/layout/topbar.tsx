'use client';

import { Search, Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SearchCommand } from './search-command';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Need to mount to access theme without hydration mismatch
  useEffect(() => setMounted(true), []);

  // Listen for ⌘K / Ctrl+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-surface-200 bg-white px-6 dark:bg-surface-950">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full rounded-md border border-surface-200 bg-surface-50 py-1.5 pl-9 pr-3 text-left text-sm text-surface-400 hover:text-surface-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-surface-900 dark:text-surface-500"
          >
            <span>Search tasks...</span>
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-surface-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-surface-400 sm:flex dark:border-surface-600 dark:bg-surface-800">
              <span>⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-md p-2 text-surface-500 hover:bg-surface-100"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Notifications */}
          <button className="relative rounded-md p-2 text-surface-500 hover:bg-surface-100">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
          </button>

          {/* Avatar placeholder */}
          <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
            U
          </div>
        </div>
      </header>

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
