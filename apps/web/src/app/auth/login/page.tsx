'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth/client';
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setError(null);

    const { data, error: authError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message ?? 'Invalid email or password');
      setIsLoading(false);
      return;
    }

    if (data) {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 animate-float rounded-full bg-brand-500/[0.03] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 animate-float rounded-full bg-purple-500/[0.03] blur-3xl" style={{ animationDelay: '2s' }} />

        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-8 shadow-lg">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/30">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-surface-900">
                Welcome back
              </h1>
              <p className="mt-1.5 text-sm text-surface-500">
                Sign in to your workspace
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div className="animate-slide-up rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error" role="alert">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error/10">
                      <span className="text-xs font-bold text-error">!</span>
                    </div>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="name@company.com"
                  className="bg-surface-100/80 dark:bg-surface-900/80"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-brand-500 transition-colors hover:text-brand-400"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="bg-surface-100/80 dark:bg-surface-900/80 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 transition-colors hover:text-surface-600 dark:hover:text-surface-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-surface-300/30" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-100 dark:bg-surface-900 px-3 text-xs font-medium uppercase tracking-wider text-surface-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11" disabled>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </Button>
              <Button variant="outline" className="h-11" disabled>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M11.4 24H0V12.6c0-1.4.3-2.7.9-3.9A9.9 9.9 0 0 1 5.2 3.6c1.4-.7 2.8-1 4.3-1h.6L10 0h7.5c1.6 0 3.1.4 4.5 1.3 1.4.9 2.4 2.1 3 3.6.7 1.6.9 3.3.7 5-.2 1.7-.8 3.2-1.8 4.6-1 1.4-2.2 2.4-3.7 3.1-1.5.7-3.1 1-4.8 1L11.4 24zM10 7.5v8c2.2 0 4.1-1.8 4.1-4.1S12.2 7.5 10 7.5z" fill="#00A4EF"/>
                </svg>
                Microsoft
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-surface-500">
              Don&apos;t have an account?{' '}
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-1 font-semibold text-brand-500 transition-colors hover:text-brand-400"
              >
                Sign up
                <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-surface-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secured with encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
}
