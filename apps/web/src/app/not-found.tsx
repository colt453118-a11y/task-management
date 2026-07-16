import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="bg-surface-50 relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-brand-500/3 absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-purple-500/3 absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full blur-3xl" />
      </div>

      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="bg-surface-100 border-surface-300/30 ring-brand-500/10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border ring-1">
          <FileQuestion className="text-surface-500 h-10 w-10" />
        </div>

        <h1 className="gradient-text text-6xl font-bold tracking-tight">404</h1>
        <h2 className="text-surface-900 mt-2 text-xl font-semibold">Page not found</h2>
        <p className="text-surface-500 mt-2 max-w-sm text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL or
          navigate back to a known page.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Button asChild variant="default" className="btn-shine rounded-xl">
            <Link href="/">
              <Home className="mr-1.5 h-4 w-4" />
              Go home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/tasks">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              View tasks
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
