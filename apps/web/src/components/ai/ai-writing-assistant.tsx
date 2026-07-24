'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, X, Check, RefreshCw, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIWritingAssistant } from '@/hooks/use-ai';
import { Button } from '@/components/ui/button';

interface AIWritingAssistantProps {
  text: string;
  onApply: (newText: string) => void;
  className?: string;
}

const INSTRUCTIONS = [
  { value: 'improve clarity', label: 'Improve Clarity' },
  { value: 'make it more concise', label: 'Make Concise' },
  { value: 'fix grammar and spelling', label: 'Fix Grammar' },
  { value: 'make it more professional', label: 'Professional Tone' },
  { value: 'make it friendlier', label: 'Friendly Tone' },
  { value: 'expand with more detail', label: 'Add Detail' },
];

export function AIWritingAssistant({ text, onApply, className }: AIWritingAssistantProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('improve clarity');
  const { result, loading, error, improve, setResult } = useAIWritingAssistant();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleImprove = async () => {
    await improve(text, instruction);
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setOpen(false);
      setResult(null);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <div ref={panelRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={!text.trim()}
        className={cn(
          'inline-flex items-center gap-1 rounded-md p-1.5 text-xs font-medium transition-colors',
          open
            ? 'bg-brand-500/10 text-brand-500'
            : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-300',
          !text.trim() && 'cursor-not-allowed opacity-40',
        )}
        title="AI Writing Assistant"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="border-surface-300/20 dark:border-surface-700/30 bg-surface-50 dark:bg-surface-900 absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border p-3 shadow-lg backdrop-blur-xl"
          >
            {!result ? (
              <>
                <p className="text-surface-700 dark:text-surface-300 mb-2 text-xs font-semibold">AI Writing Assistant</p>
                <div className="space-y-1.5">
                  {INSTRUCTIONS.map((inst) => (
                    <button
                      key={inst.value}
                      type="button"
                      onClick={() => setInstruction(inst.value)}
                      className={cn(
                        'w-full rounded-lg px-2 py-1.5 text-left text-xs transition-all',
                        instruction === inst.value
                          ? 'bg-brand-500/10 text-brand-500 font-medium'
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200/50 dark:hover:bg-surface-800/50',
                      )}
                    >
                      {inst.label}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={handleImprove}
                  disabled={loading}
                  className="mt-2 h-7 w-full rounded-lg text-xs"
                >
                  {loading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="mr-1 h-3 w-3" />
                  )}
                  {loading ? 'Improving...' : 'Improve Text'}
                </Button>
                {error && <p className="text-error mt-1 text-[10px]">{error}</p>}
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-surface-700 dark:text-surface-300 text-xs font-semibold">Preview</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-surface-500 hover:text-surface-700 rounded-lg p-1 transition-colors"
                      title="Try different instruction"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-surface-500 hover:text-surface-700 rounded-lg p-1 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="border-surface-300/20 dark:border-surface-700/30 max-h-32 overflow-y-auto rounded-lg border bg-white/50 p-2 text-xs leading-relaxed text-surface-700 dark:bg-surface-800/50 dark:text-surface-300">
                  {result}
                </div>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="mt-2 h-7 w-full rounded-lg text-xs"
                >
                  <Check className="mr-1 h-3 w-3" />
                  Apply Changes
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
