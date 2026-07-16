'use client';

import { useState, useCallback, useEffect, startTransition } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface TaskWatcherButtonProps {
  taskId: string;
}

export function TaskWatcherButton({ taskId }: TaskWatcherButtonProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchWatchers = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/watchers`);
      if (res.ok) {
        const data = await res.json();
        setIsWatching(data.isWatching ?? false);
        setWatcherCount(data.watcherCount ?? 0);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    startTransition(() => {
      fetchWatchers();
    });
  }, [fetchWatchers]);

  const toggleWatch = async () => {
    setToggling(true);
    try {
      if (isWatching) {
        const res = await fetch(`/api/tasks/${taskId}/watchers`, { method: 'DELETE' });
        if (res.ok) {
          setIsWatching(false);
          setWatcherCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const res = await fetch(`/api/tasks/${taskId}/watchers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          setIsWatching(true);
          setWatcherCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <div className="shimmer h-8 w-24 rounded-xl" />;
  }

  return (
    <Button
      variant={isWatching ? 'default' : 'outline'}
      size="sm"
      onClick={toggleWatch}
      disabled={toggling}
      className={cn(
        'h-8 shrink-0 rounded-xl text-xs transition-all duration-200',
        isWatching
          ? 'bg-brand-500/10 text-brand-500 border-brand-500/20 hover:bg-brand-500/15 hover:border-brand-500/30'
          : 'text-surface-600 dark:text-surface-400',
      )}
    >
      {toggling ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : isWatching ? (
        <Eye className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <EyeOff className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isWatching ? 'Watching' : 'Watch'}
      {watcherCount > 0 && (
        <span
          className={cn(
            'ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-medium',
            isWatching
              ? 'bg-brand-500/15 text-brand-400'
              : 'bg-surface-200/70 text-surface-500 dark:bg-surface-700/50',
          )}
        >
          {watcherCount}
        </span>
      )}
    </Button>
  );
}
