'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
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
