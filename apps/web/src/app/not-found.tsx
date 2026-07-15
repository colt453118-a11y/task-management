import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-500/3 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/3 blur-3xl" />
      </div>

      <div className="flex flex-col items-center text-center max-w-md relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-100 border border-surface-300/30 mb-6 ring-1 ring-brand-500/10">
          <FileQuestion className="h-10 w-10 text-surface-500" />
        </div>

        <h1 className="text-6xl font-bold tracking-tight gradient-text">404</h1>
        <h2 className="text-xl font-semibold text-surface-900 mt-2">
          Page not found
        </h2>
        <p className="text-sm text-surface-500 mt-2 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or navigate back to a known page.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <Button asChild variant="default" className="rounded-xl btn-shine">
            <Link href="/">
              <Home className="h-4 w-4 mr-1.5" />
              Go home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/tasks">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              View tasks
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
