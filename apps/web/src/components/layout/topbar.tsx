'use client';

import { Search, Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Need to mount to access theme without hydration mismatch
  useEffect(() => setMounted(true), []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-200 bg-white px-6 dark:bg-surface-950">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          type="search"
          placeholder="Search tasks, projects, people... (⌘K)"
          className="w-full rounded-md border border-surface-200 bg-surface-50 py-1.5 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
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
  );
}
