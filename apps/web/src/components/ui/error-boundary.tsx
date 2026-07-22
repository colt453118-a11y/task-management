'use client';

import React from 'react';
import { Button } from './button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Props ──────────────────────────────────────────────────

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback UI. Receives retry and error info. */
  fallback?: React.ReactNode | ((props: { error: Error; reset: () => void }) => React.ReactNode);
  /** Logging callback — called with the error when one is caught. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** If the values in this array change, the boundary auto-resets. */
  resetKeys?: unknown[];
  /** Optional CSS class for the fallback wrapper. */
  className?: string;
}

// ─── State ──────────────────────────────────────────────────

interface ErrorBoundaryState {
  error: Error | null;
}

// ─── Component ──────────────────────────────────────────────

/**
 * Reusable React error boundary that catches JavaScript errors anywhere
 * in its child component tree and renders a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error) => console.error(error)}
 *   resetKeys={[userId]}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Auto-reset when resetKeys change
    if (this.state.error && this.props.resetKeys && prevProps.resetKeys) {
      if (
        this.props.resetKeys.length !== prevProps.resetKeys.length ||
        this.props.resetKeys.some((key, i) => key !== prevProps.resetKeys?.[i])
      ) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({ error: this.state.error, reset: this.reset });
        }
        return this.props.fallback;
      }

      // Default fallback
      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.reset}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

// ─── Default Fallback ───────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } },
} as const;

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
  className?: string;
}

function DefaultErrorFallback({ error, reset, className }: DefaultErrorFallbackProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex flex-col items-center justify-center px-6 py-16', className)}
    >
      <motion.div
        variants={itemVariants}
        className="border-error/10 bg-error/5 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border"
      >
        <AlertCircle className="text-error h-8 w-8" />
      </motion.div>

      <motion.h2
        variants={itemVariants}
        className="text-surface-900 text-lg font-semibold"
      >
        Something went wrong
      </motion.h2>

      <motion.p
        variants={itemVariants}
        className="text-surface-500 mt-2 max-w-md text-center text-sm leading-relaxed"
      >
        An unexpected error occurred in this section. You can try again or navigate to
        another part of the application.
      </motion.p>

      {process.env.NODE_ENV === 'development' && error.message && (
        <motion.div
          variants={itemVariants}
          className="border-error/20 bg-error/[0.03] mt-4 max-w-md rounded-xl border px-4 py-2.5"
        >
          <p className="text-error/70 font-mono text-xs leading-relaxed">
            {error.message}
          </p>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="mt-6 flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={reset} className="rounded-xl">
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
            <Home className="mr-1.5 h-4 w-4" />
            Dashboard
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
