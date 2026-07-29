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
        {/* Animated background */}
        <div className="auth-orb animate-float-slow" style={{
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(52,211,153,0.08), transparent 70%)',
          top: '-100px', right: '-80px',
        }} />
        <div className="auth-noise" />

        <div className="animate-fade-in-up w-full max-w-sm">
          <div className="gradient-border-card p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-surface-900">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-surface-600">
              We sent a password reset link to{' '}
              <span className="font-medium text-surface-300">{email}</span>.
              Please check your inbox and follow the instructions.
            </p>
            <Link
              href="/auth/login"
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 transition-colors hover:text-brand-300"
            >
              Back to login
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-surface-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Your data is encrypted and secure</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center p-4">
      {/* Animated background orbs */}
      <div className="auth-orb animate-float-slow" style={{
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)',
        top: '-100px', right: '-80px',
      }} />
      <div className="auth-orb animate-float-reverse" style={{
        width: '350px', height: '350px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.06), transparent 70%)',
        bottom: '-120px', left: '-80px',
        animationDelay: '2s',
      }} />
      <div className="auth-noise" />

      <div className="relative w-full max-w-sm">
        <div className="animate-fade-in-up">
          <div className="gradient-border-card p-8">
            <div className="mb-8 text-center">
              <div className="glow-ring mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-surface-900">
                Forgot password?
              </h1>
              <p className="mt-1.5 text-sm text-surface-600">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div
                  className="animate-slide-up rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
                  role="alert"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error/10">
                      <span className="text-xs font-bold text-error">!</span>
                    </div>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-surface-600"
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
                />
              </div>

              <Button
                type="submit"
                size="xl"
                className="btn-shine w-full text-base shadow-lg shadow-brand-500/20"
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

            <p className="mt-6 text-center text-sm text-surface-600">
              Remember your password?{' '}
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 font-semibold text-brand-400 transition-colors hover:text-brand-300"
              >
                Sign in
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-surface-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Your data is encrypted and secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
