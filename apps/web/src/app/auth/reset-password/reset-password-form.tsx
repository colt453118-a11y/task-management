'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const errorParam = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === 'INVALID_TOKEN'
      ? 'Invalid or expired reset link. Please request a new one.'
      : null,
  );
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('Missing reset token. Please request a new password reset link.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const newPassword = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? 'Failed to reset password');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);
    } catch {
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-bg flex min-h-screen items-center justify-center p-4">
        <div className="animate-fade-in-up w-full max-w-sm">
          <div className="glass rounded-2xl p-8 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-surface-900 mt-5 text-xl font-bold">Password reset successful</h1>
            <p className="text-surface-500 mt-2 text-sm leading-relaxed">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Button asChild className="mt-6">
              <Link href="/auth/login">
                Sign in
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
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
        {!token ? (
          <div className="animate-fade-in-up">
            <div className="glass rounded-2xl p-8 text-center shadow-lg">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/25">
                <span className="text-xl font-bold text-white">!</span>
              </div>
              <h1 className="text-surface-900 mt-4 text-xl font-bold tracking-tight">
                Invalid link
              </h1>
              <p className="text-surface-500 mt-2 text-sm leading-relaxed">
                This password reset link is invalid or missing. Please request a new one.
              </p>
              <Link
                href="/auth/forgot-password"
                className="text-brand-500 hover:text-brand-400 mt-6 inline-flex items-center gap-1.5 font-semibold transition-colors"
              >
                Request new reset link
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="text-surface-500 mt-6 flex items-center justify-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Your data is encrypted and secure</span>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in-up">
            <div className="glass rounded-2xl p-8 shadow-lg">
              <div className="mb-8 text-center">
                <div className="from-brand-500 to-brand-700 shadow-brand-500/25 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg">
                  <KeyRound className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-surface-900 mt-4 text-2xl font-bold tracking-tight">
                  Set new password
                </h1>
                <p className="text-surface-500 mt-1.5 text-sm">Enter your new password below</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
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
                    htmlFor="password"
                    className="text-surface-500 dark:text-surface-400 text-xs font-semibold uppercase tracking-wider"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      className="bg-surface-100/80 dark:bg-surface-900/80 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="text-surface-500 dark:text-surface-400 text-xs font-semibold uppercase tracking-wider"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Repeat password"
                      className="bg-surface-100/80 dark:bg-surface-900/80 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
                      Reset password
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>
            </div>

            <div className="text-surface-500 mt-6 flex items-center justify-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Your data is encrypted and secure</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
