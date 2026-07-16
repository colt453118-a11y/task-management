'use client';

import { Loader2, AlertCircle, Inbox, FileQuestion, RefreshCw, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';

// ─── Loading Skeleton ─────────────────────────────────────────

interface LoadingSkeletonProps {
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ count = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-skeleton-pulse border-surface-300/20 bg-surface-100/80 dark:border-surface-700/30 dark:bg-surface-900/60 rounded-2xl border p-5"
        >
          <div className="bg-surface-300/50 dark:bg-surface-700/50 h-3 w-2/5 rounded-lg" />
          <div className="bg-surface-300/50 dark:bg-surface-700/50 mt-3 h-3 w-4/5 rounded-lg" />
          <div className="bg-surface-300/50 dark:bg-surface-700/50 mt-2 h-3 w-3/5 rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Card Grid Skeleton ───────────────────────────────────────

interface CardGridSkeletonProps {
  count?: number;
  gridCols?: string;
}

export function CardGridSkeleton({
  count = 4,
  gridCols = 'sm:grid-cols-2 lg:grid-cols-4',
}: CardGridSkeletonProps) {
  return (
    <div className={cn('grid gap-4', gridCols)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-skeleton-pulse border-surface-300/20 bg-surface-100/80 dark:border-surface-700/30 dark:bg-surface-900/60 rounded-2xl border p-5"
        >
          <div className="bg-surface-300/50 dark:bg-surface-700/50 h-3 w-1/3 rounded-lg" />
          <div className="bg-surface-300/50 dark:bg-surface-700/50 mt-3 h-7 w-1/2 rounded-lg" />
          <div className="bg-surface-300/50 dark:bg-surface-700/50 mt-2 h-3 w-2/3 rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div
      className="border-surface-300/20 bg-surface-100/80 dark:border-surface-700/30 dark:bg-surface-900/60 rounded-2xl border"
      role="status"
      aria-label="Loading"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-surface-300/20 dark:border-surface-700/30 border-b">
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="bg-surface-300/50 dark:bg-surface-700/50 h-3 w-16 rounded-lg" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr
                key={i}
                className="border-surface-300/10 dark:border-surface-700/20 border-b last:border-0"
              >
                {Array.from({ length: cols }, (_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div
                      className={cn(
                        'bg-surface-300/50 dark:bg-surface-700/50 h-3 rounded-lg',
                        j === 0 ? 'w-3/5' : j === cols - 1 ? 'w-1/4' : 'w-2/5',
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div
      className={cn('flex items-center justify-center gap-2', className)}
      role="status"
      aria-label={label ?? 'Loading'}
    >
      <Loader2 className={cn('text-brand-500 animate-spin', sizeMap[size])} />
      {label && <span className="text-surface-500 text-sm">{label}</span>}
      <span className="sr-only">{label ?? 'Loading...'}</span>
    </div>
  );
}

// ─── Full-page Spinner ────────────────────────────────────────

export function FullPageSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" label={label} />
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'border-error/20 bg-error/5 flex flex-col items-center justify-center rounded-2xl border px-6 py-12',
        className,
      )}
    >
      <AlertCircle className="text-error/60 h-12 w-12" />
      <h2 className="text-error mt-4 text-lg font-semibold">{title}</h2>
      {message && <p className="text-error/70 mt-2 max-w-md text-center text-sm">{message}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}

// ─── Empty State (Enhanced) ──────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
  /** Visual variant */
  variant?: 'default' | 'compact' | 'bordered';
  /** If true, children animate in with spring entrance */
  animated?: boolean;
}

const emptyStateItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, type: 'spring', stiffness: 120, damping: 14 },
  }),
};

const iconFloatAnimation = {
  y: [0, -4, 0],
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
};

export function EmptyState({
  icon = <Inbox className="text-surface-300 dark:text-surface-600 h-12 w-12" />,
  title = 'No data yet',
  message,
  action,
  className,
  variant = 'default',
  animated = true,
}: EmptyStateProps) {
  const variants = {
    default: 'px-6 py-12',
    compact: 'px-4 py-8',
    bordered: 'px-6 py-12 border-2 border-dashed',
  };

  if (!animated) {
    return (
      <div
        className={cn(
          'border-surface-300/30 bg-surface-50/50 dark:border-surface-700/30 dark:bg-surface-900/20 flex flex-col items-center justify-center rounded-2xl border border-dashed',
          variants[variant],
          className,
        )}
      >
        <div className="text-surface-300 dark:text-surface-600">{icon}</div>
        <h3 className="text-surface-600 dark:text-surface-400 mt-4 text-base font-semibold">
          {title}
        </h3>
        {message && <p className="text-surface-400 mt-1 max-w-sm text-center text-sm">{message}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  const items = [
    <motion.div
      key="icon"
      custom={0}
      variants={emptyStateItemVariants}
      initial="hidden"
      animate="visible"
      className="text-surface-300 dark:text-surface-600"
    >
      <motion.div animate={iconFloatAnimation}>{icon}</motion.div>
    </motion.div>,
    <motion.div
      key="title"
      custom={1}
      variants={emptyStateItemVariants}
      initial="hidden"
      animate="visible"
    >
      <h3 className="text-surface-600 dark:text-surface-400 text-base font-semibold">{title}</h3>
    </motion.div>,
    ...(message
      ? [
          <motion.div
            key="message"
            custom={2}
            variants={emptyStateItemVariants}
            initial="hidden"
            animate="visible"
          >
            <p className="text-surface-400 mt-1 max-w-sm text-center text-sm">{message}</p>
          </motion.div>,
        ]
      : []),
    ...(action
      ? [
          <motion.div
            key="action"
            custom={message ? 3 : 2}
            variants={emptyStateItemVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="mt-4">{action}</div>
          </motion.div>,
        ]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'border-surface-300/30 bg-surface-50/50 dark:border-surface-700/30 dark:bg-surface-900/20 flex flex-col items-center justify-center rounded-2xl border border-dashed',
        variants[variant],
        className,
      )}
    >
      {items}
    </motion.div>
  );
}

// ─── Not Found State ──────────────────────────────────────────

interface NotFoundStateProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
}

export function NotFoundState({
  title = 'Not found',
  message = 'The resource you are looking for does not exist or you do not have access.',
  backHref,
  backLabel = 'Go back',
  onBack,
}: NotFoundStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <FileQuestion className="text-surface-300 dark:text-surface-600 h-12 w-12" />
      <h2 className="text-surface-700 dark:text-surface-300 mt-4 text-xl font-semibold">{title}</h2>
      <p className="text-surface-500 mt-1 text-sm">{message}</p>
      {(backHref || onBack) && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            if (onBack) onBack();
            else if (backHref) window.location.href = backHref;
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
        </Button>
      )}
    </div>
  );
}

// ─── Inline Error Banner ──────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        'border-error/20 bg-error/5 flex items-center gap-3 rounded-2xl border px-4 py-3',
        className,
      )}
    >
      <AlertCircle className="text-error h-4 w-4 shrink-0" />
      <p className="text-error/80 flex-1 text-sm">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-error hover:text-error/70 shrink-0 text-sm font-medium"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
