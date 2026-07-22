'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { RefreshCw, FileText } from 'lucide-react';

// ─── Animations ────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } },
} as const;

// ─── Props ─────────────────────────────────────────────────

export interface DashboardSectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Lucide icon component to render (e.g. `<ListTodo />`) */
  icon: React.ReactNode;
  /** Section-specific error title */
  title: string;
  /** Section-specific error description */
  description?: string;
  /** Path to navigate to (e.g. `/tasks`) */
  navHref: string;
  /** Label for the navigation button (default: the section name) */
  navLabel?: string;
  /** Optional nav icon override (defaults to the error icon) */
  navIcon?: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────

export function DashboardSectionError({
  error,
  reset,
  icon,
  title,
  description,
  navHref,
  navLabel,
  navIcon,
}: DashboardSectionErrorProps) {
  useEffect(() => {
    console.error(`[${navHref.replace('/', '')}] Error:`, error);
  }, [error, navHref]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-24"
    >
      <motion.div
        variants={itemVariants}
        className="border-error/10 bg-error/5 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border"
      >
        {icon}
      </motion.div>

      <motion.h2
        variants={itemVariants}
        className="text-surface-900 text-xl font-semibold"
      >
        {title}
      </motion.h2>

      {description && (
        <motion.p
          variants={itemVariants}
          className="text-surface-500 mt-2 max-w-md text-center text-sm leading-relaxed"
        >
          {description}
        </motion.p>
      )}

      {error.digest && (
        <motion.div
          variants={itemVariants}
          className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/5 px-4 py-2.5 text-xs"
        >
          <FileText className="text-surface-500 h-3.5 w-3.5 shrink-0" />
          <span className="text-surface-500 font-mono">Error ID: {error.digest}</span>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="mt-8 flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={reset} className="btn-shine rounded-xl">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="outline"
            onClick={() => (window.location.href = navHref)}
            className="rounded-xl"
          >
            {navIcon ?? icon}
            <span className="ml-1.5">{navLabel ?? navHref.replace('/', '')}</span>
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
