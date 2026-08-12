'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Entrance is slide-only (no opacity fade): content paints at full opacity on
// first render, so it's eligible for LCP immediately instead of waiting for a
// fade to complete. (Same reasoning as the task-detail blank-page fix.) The
// exit still fades for a graceful leave, which doesn't affect the entering
// page's LCP.
const pageVariants = {
  initial: { y: 12 },
  animate: { y: 0 },
  exit: { opacity: 0, y: -12 },
} as const;

const pageTransition = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 20,
  mass: 0.8,
};

/**
 * Wraps page content with a spring-based entrance animation.
 * Refires the animation on route change for a polished feel.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}
