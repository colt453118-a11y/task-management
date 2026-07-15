'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, ArrowRight, AlertCircle, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ─── Types ──────────────────────────────────────────────────

interface SearchHit {
  id: string;
  title: string;
  taskIdDisplay: string;
  status: string;
  priority: string;
  description: string | null;
}

interface SearchApiResponse {
  hits: SearchHit[];
  total: number;
  estimatedTotal: number;
  searchUnavailable?: boolean;
}

const statusColorMap: Record<string, string> = {
  draft: 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  under_review: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300',
  cancelled: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
};

const priorityLabel: Record<string, string> = {
  none: 'None', low: 'Low', medium: 'Med', high: 'High', urgent: 'Urgent', critical: 'Critical',
};

// ─── Props ──────────────────────────────────────────────────

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ──────────────────────────────────────────────

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      startTransition(() => {
        setResults([]);
        setTotal(0);
        setSearchUnavailable(false);
        setLoading(false);
      });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
        if (!res.ok) throw new Error('Search failed');
        const data: SearchApiResponse = await res.json();

        if (data.searchUnavailable) {
          setSearchUnavailable(true);
          setResults([]);
        } else {
          setResults(data.hits ?? []);
          setTotal(data.total ?? 0);
          setSearchUnavailable(false);
        }
        setSelectedIndex(-1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Navigate to task
  const navigateToTask = useCallback(
    (taskId: string) => {
      onOpenChange(false);
      router.push(`/tasks/${taskId}`);
    },
    [router, onOpenChange],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        navigateToTask(results[selectedIndex]!.id);
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    },
    [results, selectedIndex, navigateToTask, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] max-w-xl translate-y-0 p-0 gap-0 overflow-hidden sm:rounded-2xl border-surface-300/20 shadow-xl">
        {/* Search input */}
        <div className="flex items-center border-b border-surface-300/20 px-4 dark:border-surface-700/30">
          <Search className="h-4 w-4 shrink-0 text-surface-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-0 bg-transparent px-3 py-4 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none dark:text-surface-100"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-surface-400" />}
          {!loading && query && (
            <kbd className="hidden rounded-lg border border-surface-300/20 bg-surface-100/80 px-1.5 py-0.5 text-xs text-surface-400 sm:inline-block dark:border-surface-700/30 dark:bg-surface-800/80">
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
          {/* Loading skeleton */}
          {loading && results.length === 0 && (
            <div className="space-y-1 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 animate-skeleton-pulse">
                  <div className="h-4 w-20 rounded-lg bg-surface-300/50 dark:bg-surface-700/50" />
                  <div className="h-4 flex-1 rounded-lg bg-surface-300/50 dark:bg-surface-700/50" />
                </div>
              ))}
            </div>
          )}

          {/* Search unavailable */}
          {searchUnavailable && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-surface-300 dark:text-surface-600" />
              <p className="text-sm text-surface-500">Search is not configured.</p>
              <p className="text-xs text-surface-400 max-w-xs">Set up Meilisearch to enable full-text search. Until then, use the task list filters.</p>
            </div>
          )}

          {/* Error */}
          {error && <div className="px-6 py-4 text-center text-sm text-error">{error}</div>}

          {/* Empty state */}
          {!loading && !searchUnavailable && !error && query && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <FileText className="h-8 w-8 text-surface-300 dark:text-surface-600" />
              <p className="text-sm text-surface-500">No tasks found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {/* Result list */}
          {results.length > 0 && (
            <div className="p-2">
              <p className="px-3 pb-1.5 text-xs font-medium text-surface-400">Tasks ({total})</p>
              {results.map((hit, index) => (
                <button
                  key={hit.id}
                  onClick={() => navigateToTask(hit.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-brand-500/10 text-brand-400 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-surface-700 hover:bg-surface-200/50 dark:text-surface-300 dark:hover:bg-surface-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="shrink-0 font-mono text-xs text-surface-400">{hit.taskIdDisplay}</span>
                    <span className="truncate">{hit.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColorMap[hit.status] ?? 'bg-surface-100 text-surface-600'}`}>
                      {hit.status.replace(/_/g, ' ')}
                    </span>
                    {hit.priority && hit.priority !== 'none' && (
                      <span className="text-[10px] text-surface-400 font-medium uppercase">{priorityLabel[hit.priority] ?? hit.priority}</span>
                    )}
                    {index === selectedIndex && <ArrowRight className="h-3.5 w-3.5 text-brand-500 shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Initial state */}
          {!query && !loading && (
            <div className="px-6 py-8 text-center text-sm text-surface-400">
              <p>Type to search tasks</p>
              <p className="mt-1 text-xs text-surface-300">Search by title, description, or task ID</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="hidden border-t border-surface-300/20 px-4 py-2 text-xs text-surface-400 sm:flex items-center gap-4 dark:border-surface-700/30">
          <span className="flex items-center gap-1">
            <kbd className="rounded-lg border border-surface-300/20 bg-surface-100/80 px-1.5 py-0.5 text-[10px] dark:border-surface-700/30 dark:bg-surface-800/80">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded-lg border border-surface-300/20 bg-surface-100/80 px-1.5 py-0.5 text-[10px] dark:border-surface-700/30 dark:bg-surface-800/80">↵</kbd>
            <span>Open</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded-lg border border-surface-300/20 bg-surface-100/80 px-1.5 py-0.5 text-[10px] dark:border-surface-700/30 dark:bg-surface-800/80">Esc</kbd>
            <span>Close</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
