'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, LayoutDashboard, FileText } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } },
};

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] Unhandled error:', error);
  }, [error]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-24"
    >
      {/* Error icon */}
      <motion.div
        variants={itemVariants}
        className="border-error/10 bg-error/5 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border"
      >
        <AlertCircle className="text-error h-10 w-10" />
      </motion.div>

      {/* Title */}
      <motion.h2
        variants={itemVariants}
        className="text-surface-900 text-xl font-semibold"
      >
        Something went wrong
      </motion.h2>

      {/* Description */}
      <motion.p
        variants={itemVariants}
        className="text-surface-500 mt-2 max-w-md text-center text-sm leading-relaxed"
      >
        An unexpected error occurred in this section. The sidebar and top navigation
        are still available so you can easily navigate elsewhere.
      </motion.p>

      {/* Error digest */}
      {error.digest && (
        <motion.div
          variants={itemVariants}
          className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/5 px-4 py-2.5 text-xs"
        >
          <FileText className="text-surface-500 h-3.5 w-3.5 shrink-0" />
          <span className="text-surface-500 font-mono">Error ID: {error.digest}</span>
        </motion.div>
      )}

      {/* Actions */}
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
            onClick={() => (window.location.href = '/')}
            className="rounded-xl"
          >
            <LayoutDashboard className="mr-1.5 h-4 w-4" />
            Dashboard
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
