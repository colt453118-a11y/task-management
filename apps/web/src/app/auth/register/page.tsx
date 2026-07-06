'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth/client';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    const { data, error: authError } = await authClient.signUp.email({
      name: `${firstName} ${lastName}`,
      email,
      password,
    });

    if (authError) {
      setError(authError.message ?? 'Registration failed');
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
            Create an account
          </h1>
          <p className="text-sm text-surface-500">Get started with WorkManager</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium text-surface-700 dark:text-surface-300">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className={cn(
                  'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                  'dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100',
                )}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className={cn(
                  'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                  'dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100',
                )}
              />
            </div>
          </div>

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
            <label htmlFor="password" className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={cn(
                'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
                'placeholder:text-surface-400',
                'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                'dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100',
              )}
              placeholder="Min. 8 characters"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-xs text-surface-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
