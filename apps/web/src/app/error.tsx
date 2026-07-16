'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="bg-surface-50 relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-error/3 absolute right-1/3 top-1/3 h-80 w-80 rounded-full blur-3xl" />
        <div className="bg-orange-500/3 absolute bottom-1/3 left-1/3 h-60 w-60 rounded-full blur-3xl" />
      </div>

      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="bg-error/5 border-error/10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border">
          <AlertCircle className="text-error h-10 w-10" />
        </div>

        <h2 className="text-surface-900 text-xl font-semibold">Something went wrong</h2>
        <p className="text-surface-500 mt-2 text-sm">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="text-surface-500 bg-surface-100 mt-2 block rounded-lg px-2 py-1 font-mono text-xs">
              Error ID: {error.digest}
            </span>
          )}
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Button onClick={reset} className="btn-shine rounded-xl">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="rounded-xl"
          >
            <Home className="mr-1.5 h-4 w-4" />
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
