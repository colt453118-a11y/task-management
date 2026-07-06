'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // TODO: Implement Better Auth login
    console.log('Login', { email, password });

    // Simulate login
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 1000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-4 dark:bg-surface-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-surface-500">Sign in to your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={cn(
                'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm',
                'placeholder:text-surface-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Password
              </label>
              <a
                href="/forgot-password"
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={cn(
                'flex h-9 w-full rounded-md border border-surface-300 bg-white px-3 py-1 text-sm shadow-sm',
                'placeholder:text-surface-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                'disabled:cursor-not-allowed disabled:opacity-50',
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
            <span className="w-full border-t border-surface-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface-50 px-2 text-surface-500 dark:bg-surface-950">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full" disabled>
            Google
          </Button>
          <Button variant="outline" className="w-full" disabled>
            Microsoft
          </Button>
        </div>

        <p className="text-center text-xs text-surface-500">
          Don&apos;t have an account?{' '}
          <a href="/register" className="text-brand-600 hover:text-brand-700">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
