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
      {/* Animated background orbs */}
      <div className="auth-orb animate-float-slow" style={{
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.1), transparent 70%)',
        top: '-150px', left: '-100px',
      }} />
      <div className="auth-orb animate-float-reverse" style={{
        width: '450px', height: '450px',
        background: 'radial-gradient(circle, rgba(192,132,252,0.07), transparent 70%)',
        bottom: '-150px', right: '-100px',
        animationDelay: '2.5s',
      }} />
      <div className="auth-orb" style={{
        width: '250px', height: '250px',
        background: 'radial-gradient(circle, rgba(34,211,238,0.04), transparent 70%)',
        top: '40%', left: '5%',
        filter: 'blur(50px)',
      }} />

      {/* Noise texture */}
      <div className="auth-noise" />

      {/* Geometric shapes */}
      <div className="auth-geo animate-rotate-slow" style={{
        width: '80px', height: '80px', borderRadius: '40%',
        top: '20%', right: '10%',
        borderColor: 'rgba(167,139,250,0.06)',
      }} />
      <div className="auth-geo animate-drift" style={{
        width: '50px', height: '50px',
        borderRadius: '30% 60% 30% 60%',
        bottom: '30%', left: '8%',
        borderColor: 'rgba(99,102,241,0.05)',
      }} />

      <div className="relative w-full max-w-sm">
        <div className="animate-fade-in-up">
          <div className="gradient-border-card p-8">
            <div className="mb-8 text-center">
              <div className="glow-ring mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/30">
                <UserPlus className="h-7 w-7 text-white" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-surface-900">
                Create an account
              </h1>
              <p className="mt-1.5 text-sm text-surface-600">
                Get started with your workspace
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-xs font-semibold uppercase tracking-wider text-surface-600"
                  >
                    First name
                  </label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-xs font-semibold uppercase tracking-wider text-surface-600"
                  >
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

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

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-surface-600"
                >
                  Password
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
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-600 transition-colors hover:text-surface-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-surface-600">Must be at least 8 characters</p>
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
                    Create account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-surface-600">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 font-semibold text-brand-400 transition-colors hover:text-brand-300"
              >
                Sign in
                <ArrowRight className="h-3 w-3" />
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
