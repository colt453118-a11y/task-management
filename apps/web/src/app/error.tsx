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
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-80 h-80 rounded-full bg-error/3 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-60 h-60 rounded-full bg-orange-500/3 blur-3xl" />
      </div>

      <div className="flex flex-col items-center text-center max-w-md relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-error/5 border border-error/10 mb-6">
          <AlertCircle className="h-10 w-10 text-error" />
        </div>

        <h2 className="text-xl font-semibold text-surface-900">
          Something went wrong
        </h2>
        <p className="text-sm text-surface-500 mt-2">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="block mt-2 font-mono text-xs text-surface-500 bg-surface-100 rounded-lg px-2 py-1">
              Error ID: {error.digest}
            </span>
          )}
        </p>

        <div className="flex items-center gap-3 mt-8">
          <Button onClick={reset} className="rounded-xl btn-shine">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'} className="rounded-xl">
            <Home className="h-4 w-4 mr-1.5" />
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
