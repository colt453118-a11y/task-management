import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6 dark:bg-surface-950">
      <div className="flex flex-col items-center text-center max-w-md">
        <FileQuestion className="h-16 w-16 text-surface-300 mb-4" />
        <h2 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">
          Page not found
        </h2>
        <p className="text-sm text-surface-500 mt-2">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
