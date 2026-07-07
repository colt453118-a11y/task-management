'use client';

import { Loader2, AlertCircle, Inbox, FileQuestion, RefreshCw, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// ─── Loading Skeleton ─────────────────────────────────────────

interface LoadingSkeletonProps {
  /** Number of skeleton rows to render */
  count?: number;
  /** Optional className override */
  className?: string;
}

export function LoadingSkeleton({ count = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-surface-200 bg-white p-5 dark:border-surface-700 dark:bg-surface-900"
        >
          <div className="h-3 w-2/5 rounded bg-surface-200 dark:bg-surface-700" />
          <div className="mt-3 h-3 w-4/5 rounded bg-surface-200 dark:bg-surface-700" />
          <div className="mt-2 h-3 w-3/5 rounded bg-surface-200 dark:bg-surface-700" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Card Loading Skeleton (grid-friendly) ────────────────────

interface CardGridSkeletonProps {
  /** Number of card skeletons */
  count?: number;
  /** Grid column classes (default: sm:grid-cols-2 lg:grid-cols-4) */
  gridCols?: string;
}

export function CardGridSkeleton({ count = 4, gridCols = 'sm:grid-cols-2 lg:grid-cols-4' }: CardGridSkeletonProps) {
  return (
    <div className={cn('grid gap-4', gridCols)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-surface-200 bg-white p-5 dark:border-surface-700 dark:bg-surface-900"
        >
          <div className="h-3 w-1/3 rounded bg-surface-200 dark:bg-surface-700" />
          <div className="mt-3 h-7 w-1/2 rounded bg-surface-200 dark:bg-surface-700" />
          <div className="mt-2 h-3 w-2/3 rounded bg-surface-200 dark:bg-surface-700" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Table Row Skeleton ──────────────────────────────────────

interface TableSkeletonProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900" role="status" aria-label="Loading">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 dark:border-surface-700">
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-3 w-16 rounded bg-surface-200 dark:bg-surface-700" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                {Array.from({ length: cols }, (_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div
                      className={cn(
                        'h-3 rounded bg-surface-200 dark:bg-surface-700',
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

// ─── Spinner (inline loading) ─────────────────────────────────

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div className={cn('flex items-center justify-center gap-2', className)} role="status" aria-label={label ?? 'Loading'}>
      <Loader2 className={cn('animate-spin text-brand-500', sizeMap[size])} />
      {label && <span className="text-sm text-surface-500">{label}</span>}
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
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/50 px-6 py-12 dark:border-red-900 dark:bg-red-950/20', className)}>
      <AlertCircle className="h-12 w-12 text-red-400" />
      <h2 className="mt-4 text-lg font-semibold text-red-700 dark:text-red-400">{title}</h2>
      {message && (
        <p className="mt-2 max-w-md text-center text-sm text-red-500 dark:text-red-400">
          {message}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <Inbox className="h-12 w-12 text-surface-300" />,
  title = 'No data yet',
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-300 bg-surface-50/50 px-6 py-12 dark:border-surface-600 dark:bg-surface-900/20', className)}>
      {icon}
      <h3 className="mt-4 text-base font-semibold text-surface-600 dark:text-surface-400">{title}</h3>
      {message && (
        <p className="mt-1 max-w-sm text-center text-sm text-surface-400">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
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
      <FileQuestion className="h-12 w-12 text-surface-300" />
      <h2 className="mt-4 text-xl font-semibold text-surface-700 dark:text-surface-300">{title}</h2>
      <p className="mt-1 text-sm text-surface-500">{message}</p>
      {(backHref || onBack) && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            if (onBack) onBack();
            else if (backHref) window.location.href = backHref;
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
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
    <div className={cn('flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/20', className)}>
      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
      <p className="flex-1 text-sm text-red-700 dark:text-red-400">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-sm font-medium text-red-600 hover:text-red-500"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
