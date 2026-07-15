'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: `${BASE_URL}/auth/reset-password`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? 'Failed to send reset email');
        setIsLoading(false);
        return;
      }
    } catch {
      setError('Network error. Please try again.');
      setIsLoading(false);
      return;
    }

    setSent(true);
    setIsLoading(false);
  }

  if (sent) {
    return (
      <div className="auth-bg flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="glass rounded-2xl p-8 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-surface-900">Check your email</h1>
            <p className="mt-2 text-sm text-surface-500 leading-relaxed">
              We sent a password reset link to <span className="font-medium text-surface-700 dark:text-surface-300">{email}</span>. Please check your inbox and follow the instructions.
            </p>
            <Link
              href="/auth/login"
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 transition-colors hover:text-brand-400"
            >
              Back to login
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-surface-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Your data is encrypted and secure</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 animate-float rounded-full bg-brand-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 animate-float rounded-full bg-purple-500/5 blur-3xl" style={{ animationDelay: '1.5s' }} />

        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-8 shadow-lg">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-surface-900">
                Forgot password?
              </h1>
              <p className="mt-1.5 text-sm text-surface-500">
                Enter your email and we&apos;ll send you a reset link
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
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Email</label>
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

              <Button type="submit" className="w-full h-11 text-base shadow-sm" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Send reset link
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-surface-500">
              Remember your password?{' '}
              <Link href="/auth/login" className="inline-flex items-center gap-1 font-semibold text-brand-500 transition-colors hover:text-brand-400">
                Sign in
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-surface-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Your data is encrypted and secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
