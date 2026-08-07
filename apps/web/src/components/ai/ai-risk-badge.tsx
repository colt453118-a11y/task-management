'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIRiskPrediction } from '@/hooks/use-ai';

interface AIRiskBadgeProps {
  task: {
    id: string;
    title: string;
    dueDate?: string;
    status: string;
    estimatedHours?: string;
    description?: string;
  };
  className?: string;
}

const riskConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low Risk', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  medium: { label: 'Medium Risk', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  high: { label: 'High Risk', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  critical: { label: 'Critical Risk', color: 'text-red-500', bg: 'bg-red-500/10' },
};

export function AIRiskBadge({ task, className }: AIRiskBadgeProps) {
  const [open, setOpen] = useState(false);
  const { prediction, loading, error, predictRisk } = useAIRiskPrediction();

  const handleClick = async () => {
    if (prediction) {
      setOpen(!open);
      return;
    }
    await predictRisk(task);
    setOpen(true);
  };

  const config = prediction ? riskConfig[prediction.riskLevel] ?? riskConfig.medium : null;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all',
          config
            ? `${config.bg} ${config.color}`
            : 'bg-surface-200/50 text-surface-500 hover:bg-surface-200/70',
          loading && 'animate-pulse',
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Brain className="h-3 w-3" />
        )}
        {config ? config.label : 'AI Risk'}
      </button>

      <AnimatePresence>
        {open && prediction && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="border-surface-300/20 bg-surface-50 absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border p-3 shadow-lg backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Brain className={cn('h-3.5 w-3.5', config?.color)} />
                <span className={cn(config?.color)}>{config?.label}</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-surface-400 hover:text-surface-600 rounded-lg p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Risk score bar */}
            <div className="mb-2">
              <div className="text-surface-500 mb-1 flex items-center justify-between text-[10px]">
                <span>Risk Score</span>
                <span className={cn('font-semibold', config?.color)}>{prediction.riskScore}/100</span>
              </div>
              <div className="bg-surface-200 h-1.5 w-full overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${prediction.riskScore}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={cn(
                    'h-full rounded-full',
                    prediction.riskLevel === 'critical' ? 'bg-red-500' :
                    prediction.riskLevel === 'high' ? 'bg-orange-500' :
                    prediction.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                />
              </div>
            </div>

            <p className="text-surface-600 text-[10px] leading-relaxed">
              {prediction.reason}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-error mt-1 text-[10px]">{error}</p>
      )}
    </div>
  );
}
