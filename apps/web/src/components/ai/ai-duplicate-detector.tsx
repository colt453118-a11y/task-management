'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIDuplicateDetection } from '@/hooks/use-ai';

interface AIDuplicateDetectorProps {
  title: string;
  existingTitles: string[];
  debounceMs?: number;
  className?: string;
}

export function AIDuplicateDetector({
  title,
  existingTitles,
  debounceMs = 1500,
  className,
}: AIDuplicateDetectorProps) {
  const [dismissed, setDismissed] = useState(false);
  const { duplicates, checkDuplicates } = useAIDuplicateDetection();

  const highConfidenceDuplicates = duplicates.filter((d) => d.similarityScore >= 70);

  // Debounced duplicate check
  useEffect(() => {
    if (!title.trim() || title.length < 3 || dismissed) return;

    const timer = setTimeout(() => {
      checkDuplicates(title, existingTitles);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [title, existingTitles, debounceMs, dismissed, checkDuplicates]);

  // Reset dismissed state when title changes significantly
  useEffect(() => {
    if (dismissed) setDismissed(false);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (highConfidenceDuplicates.length === 0 || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn('rounded-xl border border-amber-500/20 bg-amber-500/5 p-3', className)}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-amber-500 mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold">
                Potential Duplicate{highConfidenceDuplicates.length > 1 ? 's' : ''} Detected
              </p>
              <button
                onClick={() => setDismissed(true)}
                className="text-surface-400 hover:text-surface-600 rounded-lg p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-surface-500 mt-1 text-[10px]">
              One or more tasks with similar titles already exist
            </p>
            <div className="mt-2 space-y-1">
              {highConfidenceDuplicates.slice(0, 3).map((dup, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-amber-500/5 px-2 py-1"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Copy className="text-surface-400 h-3 w-3 shrink-0" />
                    <span className="text-surface-600 dark:text-surface-400 truncate text-[10px]">
                      {dup.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'text-[9px] font-medium',
                        dup.similarityScore >= 90
                          ? 'text-red-500'
                          : dup.similarityScore >= 80
                            ? 'text-orange-500'
                            : 'text-amber-500',
                      )}
                    >
                      {dup.similarityScore}%
                    </span>
                    {dup.reason && (
                      <span className="text-surface-400 max-w-[100px] truncate text-[9px]" title={dup.reason}>
                        {dup.reason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
