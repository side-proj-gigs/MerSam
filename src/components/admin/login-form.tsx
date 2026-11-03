'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.post<{ user: { name: string } }>(
        '/api/auth/login',
        { email, password },
        // Signing in twice should produce a second session, not a replay.
        { idempotent: false },
      );

      toast.success(`Welcome back, ${result.user.name.split(' ')[0]}`);

      // The destination is validated as a local path so the `next` parameter
      // cannot be used to bounce someone to another site after signing in.
      const requested = params.get('next') ?? '/admin';
      const destination = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/admin';

      router.replace(destination);
      router.refresh();
    } catch (failure) {
      const message =
        failure instanceof ApiError ? failure.message : 'Sign in failed, please try again';
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <Input
        label="Email address"
        type="email"
        autoComplete="username"
        required
        autoFocus
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        leadingIcon={<Mail className="size-4" aria-hidden />}
        placeholder="admin@mersam.com"
      />

      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        leadingIcon={<KeyRound className="size-4" aria-hidden />}
        placeholder="Your password"
        error={error ?? undefined}
      />

      <Button
        type="submit"
        variant="gold"
        size="lg"
        loading={submitting}
        className="mt-2"
        disabled={!email || !password}
      >
        {submitting ? 'Signing you in' : 'Sign in'}
        {!submitting && <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}
