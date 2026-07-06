'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth/client';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { data, error: authError } = await authClient.signIn.email({
      email,
      password,
    });

    if (authError) {
      setError(authError.message ?? 'Invalid email or password');
      setIsLoading(false);
      return;
    }

    if (data) {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-4 dark:bg-surface-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
            <span className="text-lg font-bold text-white">W</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-surface-900 dark:text-surface-50">
            Welcome back
          </h1>
          <p className="text-sm text-surface-500">Sign in to your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={cn(
                'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
                'placeholder:text-surface-400',
                'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                'dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100',
              )}
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={cn(
                'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
                'placeholder:text-surface-400',
                'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                'dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100',
              )}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-surface-300 dark:border-surface-600" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface-50 px-2 text-surface-500 dark:bg-surface-950">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full" disabled>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </Button>
          <Button variant="outline" className="w-full" disabled>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M11.4 24H0V12.6c0-1.4.3-2.7.9-3.9A9.9 9.9 0 0 1 5.2 3.6c1.4-.7 2.8-1 4.3-1h.6L10 0h7.5c1.6 0 3.1.4 4.5 1.3 1.4.9 2.4 2.1 3 3.6.7 1.6.9 3.3.7 5-.2 1.7-.8 3.2-1.8 4.6-1 1.4-2.2 2.4-3.7 3.1-1.5.7-3.1 1-4.8 1L11.4 24zM10 7.5v8c2.2 0 4.1-1.8 4.1-4.1S12.2 7.5 10 7.5z" fill="#00A4EF"/></svg>
            Microsoft
          </Button>
        </div>

        <p className="text-center text-xs text-surface-500">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
