'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth/client';
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    const { data, error: authError } = await authClient.signUp.email({
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message ?? 'Registration failed');
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
                <UserPlus className="h-7 w-7 text-white" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-surface-900">
                Create an account
              </h1>
              <p className="mt-1.5 text-sm text-surface-500">
                Get started with your workspace
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">First name</label>
                  <Input id="firstName" name="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="bg-surface-100/80 dark:bg-surface-900/80" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Last name</label>
                  <Input id="lastName" name="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="bg-surface-100/80 dark:bg-surface-900/80" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Email</label>
                <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="name@company.com" className="bg-surface-100/80 dark:bg-surface-900/80" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Password</label>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} placeholder="Min. 8 characters" className="bg-surface-100/80 dark:bg-surface-900/80 pr-11" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 transition-colors hover:text-surface-600 dark:hover:text-surface-300" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-surface-500">Must be at least 8 characters</p>
              </div>

              <Button type="submit" className="w-full h-11 text-base shadow-sm" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Create account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-surface-500">
              Already have an account?{' '}
              <Link href="/auth/login" className="inline-flex items-center gap-1 font-semibold text-brand-500 transition-colors hover:text-brand-400">
                Sign in
                <ArrowRight className="h-3 w-3" />
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
