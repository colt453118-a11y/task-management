'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6 dark:bg-surface-950">
      <div className="flex flex-col items-center text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Something went wrong
        </h2>
        <p className="text-sm text-surface-500 mt-2">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs text-surface-400">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3 mt-6">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
