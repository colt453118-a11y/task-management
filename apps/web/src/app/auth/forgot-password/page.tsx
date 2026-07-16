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
        <div className="animate-fade-in-up w-full max-w-sm">
          <div className="glass rounded-2xl p-8 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-surface-900 mt-5 text-xl font-bold">Check your email</h1>
            <p className="text-surface-500 mt-2 text-sm leading-relaxed">
              We sent a password reset link to{' '}
              <span className="text-surface-700 dark:text-surface-300 font-medium">{email}</span>.
              Please check your inbox and follow the instructions.
            </p>
            <Link
              href="/auth/login"
              className="text-brand-500 hover:text-brand-400 group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              Back to login
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="text-surface-500 mt-6 flex items-center justify-center gap-2 text-xs">
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
        <div className="animate-float bg-brand-500/5 pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl" />
        <div
          className="animate-float pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl"
          style={{ animationDelay: '1.5s' }}
        />

        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-8 shadow-lg">
            <div className="mb-8 text-center">
              <div className="from-brand-500 to-brand-700 shadow-brand-500/25 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-surface-900 mt-4 text-2xl font-bold tracking-tight">
                Forgot password?
              </h1>
              <p className="text-surface-500 mt-1.5 text-sm">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div
                  className="animate-slide-up border-error/20 bg-error/5 text-error rounded-xl border px-4 py-3 text-sm"
                  role="alert"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="bg-error/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      <span className="text-error text-xs font-bold">!</span>
                    </div>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-surface-500 dark:text-surface-400 text-xs font-semibold uppercase tracking-wider"
                >
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

              <Button
                type="submit"
                className="h-11 w-full text-base shadow-sm"
                disabled={isLoading}
              >
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

            <p className="text-surface-500 mt-6 text-center text-sm">
              Remember your password?{' '}
              <Link
                href="/auth/login"
                className="text-brand-500 hover:text-brand-400 inline-flex items-center gap-1 font-semibold transition-colors"
              >
                Sign in
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>

          <div className="text-surface-500 mt-6 flex items-center justify-center gap-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Your data is encrypted and secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
