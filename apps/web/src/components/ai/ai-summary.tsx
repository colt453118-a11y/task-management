'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISummary } from '@/hooks/use-ai';

interface AISummaryProps {
  title: string;
  description: string;
  className?: string;
}

export function AISummary({ title, description, className }: AISummaryProps) {
  const [open, setOpen] = useState(false);
  const { summary, loading, error, generateSummary } = useAISummary();

  const handleGenerate = async () => {
    if (summary) {
      setOpen(!open);
      return;
    }
    await generateSummary(title, description);
    setOpen(true);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
          summary
            ? 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/15'
            : 'bg-surface-200/50 text-surface-500 hover:bg-surface-200/70 hover:text-surface-700 dark:bg-surface-700/30 dark:text-surface-400 dark:hover:bg-surface-700/50 dark:hover:text-surface-300',
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span>{loading ? 'Summarizing...' : summary ? (open ? 'Hide AI Summary' : 'Show AI Summary') : 'AI Summary'}</span>
        {summary && (
          <span className="text-surface-400 ml-0.5">
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && summary && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden"
          >
            <div className="border-brand-500/20 bg-brand-500/5 dark:bg-brand-500/10 relative rounded-xl border p-3">
              <div className="absolute right-2 top-2">
                <button
                  onClick={() => setOpen(false)}
                  className="text-surface-400 hover:text-surface-600 rounded-lg p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="text-brand-500 mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="text-surface-700 dark:text-surface-300 text-xs leading-relaxed">
                  {summary}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-error mt-1 text-[10px]">{error}</p>
      )}
    </div>
  );
}
