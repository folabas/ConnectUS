'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoMark } from '@/components/brand/Logo';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { cn, field, focusRing } from '@/lib/ui';

type Mode = 'signin' | 'signup' | 'forgot';

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in to pick up where you left off.',
    submit: 'Sign in',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Host your first watch party in under a minute.',
    submit: 'Create account',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'We will email you a link to choose a new one.',
    submit: 'Send reset link',
  },
};

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, status } = useAuth();

  const next = searchParams.get('next') || '/library';
  const expired = searchParams.get('expired');

  const [mode, setMode] = useState<Mode>('signin');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });

  useEffect(() => {
    if (expired) toast.info('Your session expired. Please sign in again.');
  }, [expired]);

  // Someone already signed in has no business on this screen.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, router, next]);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.email.trim()) errors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'That does not look like a valid email.';
    }
    if (mode !== 'forgot') {
      if (!form.password) errors.password = 'Enter your password.';
      else if (mode === 'signup' && form.password.length < 8) {
        errors.password = 'Use at least 8 characters.';
      }
    }
    if (mode === 'signup' && !form.fullName.trim()) {
      errors.fullName = 'Tell us what to call you.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn({ email: form.email.trim(), password: form.password });
        toast.success('Welcome back.');
        router.replace(next);
      } else if (mode === 'signup') {
        await signUp({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
        });
        toast.success('Account created.');
        router.replace(next);
      } else {
        await authApi.forgotPassword(form.email.trim());
        toast.success('Check your inbox for the reset link.');
        setMode('signin');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const copy = COPY[mode];

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-white">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] via-[var(--brand-soft)] to-[var(--brand-hover)]" />
        <div className="absolute left-20 top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 flex w-full items-center justify-center p-16">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="max-w-md space-y-6 text-center"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-xl">
              <LogoMark size={44} monochrome className="text-white" />
            </div>
            <h2 className="text-4xl tracking-tight">Movie night, wherever everyone is</h2>
            <p className="text-lg leading-relaxed text-white/80">
              Perfectly synced playback, live chat, and video calls — so it feels like the
              same couch.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md"
        >
          <Link
            href="/"
            className={cn(
              'mb-8 inline-flex items-center gap-2 rounded-lg text-sm text-white/60 transition-colors hover:text-white',
              focusRing,
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl tracking-tight sm:text-4xl">{copy.title}</h1>
            <p className="mt-2 text-white/60">{copy.subtitle}</p>
          </div>

          <form onSubmit={submit} noValidate className="space-y-4">
            {mode === 'signup' && (
              <Field
                id="fullName"
                label="Full name"
                icon={UserIcon}
                error={fieldErrors.fullName}
              >
                <Input
                  id="fullName"
                  name="name"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={form.fullName}
                  onChange={update('fullName')}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={cn(field, 'pl-11')}
                />
              </Field>
            )}

            <Field id="email" label="Email address" icon={Mail} error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update('email')}
                aria-invalid={Boolean(fieldErrors.email)}
                className={cn(field, 'pl-11')}
              />
            </Field>

            {mode !== 'forgot' && (
              <Field id="password" label="Password" icon={Lock} error={fieldErrors.password}>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  value={form.password}
                  onChange={update('password')}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={cn(field, 'pl-11')}
                />
              </Field>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className={cn('rounded text-sm text-[var(--brand-soft)] hover:text-[#a99fff]', focusRing)}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.submit}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-white/60">
            {mode === 'signup' ? 'Already have an account? ' : null}
            {mode === 'signin' ? "Don't have an account? " : null}
            {mode === 'forgot' ? 'Remembered it? ' : null}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className={cn('rounded text-[var(--brand-soft)] hover:text-[#a99fff]', focusRing)}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-white/70">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-white/40" />
        {children}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
