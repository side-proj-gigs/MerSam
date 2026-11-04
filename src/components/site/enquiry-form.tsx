'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ServiceWithCategory } from '@core/entities';
import { URGENCY_LEVELS, type Urgency } from '@core/entities';
import { api, ApiError } from '@/lib/api-client';
import { cn, newIdempotencyKey } from '@/lib/utils';
import { useLocalStorage } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';

const URGENCY_LABELS: Record<Urgency, string> = {
  flexible: 'Whenever suits you',
  this_week: 'Some time this week',
  urgent: 'Urgent, within 48 hours',
  emergency: 'Emergency, today',
};

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  location: string;
  serviceId: string;
  urgency: Urgency;
  budgetHint: string;
  message: string;
}

const EMPTY: FormState = {
  fullName: '',
  phone: '',
  email: '',
  location: '',
  serviceId: '',
  urgency: 'flexible',
  budgetHint: '',
  message: '',
};

/** Mirrors the server rules so the person sees the problem before submitting. */
function validate(state: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (state.fullName.trim().length < 2) errors.fullName = 'Please tell us your name';

  const digits = state.phone.replace(/\D/g, '');
  if (digits.length < 9) errors.phone = 'Enter a phone number we can reach you on';

  if (state.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(state.email.trim())) {
    errors.email = 'That email address does not look right';
  }

  if (state.message.trim().length < 10) {
    errors.message = 'Please describe what you need in a little more detail';
  }

  return errors;
}

export function EnquiryForm({
  services,
  defaultServiceId,
  className,
}: {
  services: ServiceWithCategory[];
  defaultServiceId?: string;
  className?: string;
}) {
  const [state, setState] = useState<FormState>({ ...EMPTY, serviceId: defaultServiceId ?? '' });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // One key per filled-in form. A double click, or a retry after a dropped
  // connection, replays the first result instead of logging a second enquiry.
  const idempotencyKey = useRef(newIdempotencyKey('enquiry'));

  // The draft survives an accidental tab close, which matters on a long form.
  const draft = useLocalStorage<Partial<FormState>>('mersam-enquiry-draft', {});

  useEffect(() => {
    if (!draft.hydrated || reference) return;
    const saved = draft.value;
    if (saved && Object.keys(saved).length > 0) {
      setState((current) => ({ ...current, ...saved }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.hydrated]);

  const errors = useMemo(() => validate(state), [state]);
  const clientErrors = Object.keys(errors).length;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => {
      const next = { ...current, [key]: value };
      draft.setValue(next);
      return next;
    });
    setServerErrors((current) => {
      if (!current[key]) return current;
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  };

  const errorFor = (key: keyof FormState) =>
    serverErrors[key] ?? (touched[key] ? errors[key] : undefined);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (clientErrors > 0) {
      setTouched({ fullName: true, phone: true, email: true, message: true });
      toast.error('Please check the highlighted fields');
      return;
    }

    setSubmitting(true);
    setServerErrors({});

    try {
      const honeypot = new FormData(event.currentTarget).get('website');
      const result = await api.post<{ reference: string }>(
        '/api/enquiries',
        {
          fullName: state.fullName,
          phone: state.phone,
          email: state.email || undefined,
          location: state.location,
          serviceId: state.serviceId || null,
          urgency: state.urgency,
          budgetHint: state.budgetHint || null,
          message: state.message,
          website: honeypot ?? '',
        },
        { idempotencyKey: idempotencyKey.current },
      );

      setReference(result.reference);
      draft.clear();
      toast.success('Enquiry received', { description: `Your reference is ${result.reference}` });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerErrors(error.fieldErrors);
        toast.error(error.message);
        // A rejected attempt gets a fresh key so a corrected retry goes through.
        if (error.status >= 400 && error.status < 500) {
          idempotencyKey.current = newIdempotencyKey('enquiry');
        }
      } else {
        toast.error('Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-14 text-center',
          className,
        )}
      >
        <span className="grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Thank you, we have it
          </h3>
          <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
            One of our engineers will call you back. For anything urgent, ring us directly rather
            than waiting for the callback.
          </p>
        </div>
        <p className="rounded-full bg-[var(--surface-sunken)] px-4 py-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">
          {reference}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setReference(null);
            setState({ ...EMPTY, serviceId: defaultServiceId ?? '' });
            setTouched({});
            idempotencyKey.current = newIdempotencyKey('enquiry');
          }}
        >
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(
        'flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-lift)] sm:p-7',
        className,
      )}
    >
      {/* Hidden from people, visible to naive bots. */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Your name"
          required
          autoComplete="name"
          value={state.fullName}
          onChange={(event) => set('fullName', event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
          error={errorFor('fullName')}
          placeholder="Kwame Mensah"
        />
        <Input
          label="Phone number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={state.phone}
          onChange={(event) => set('phone', event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
          error={errorFor('phone')}
          hint="We will call you on this number"
          placeholder="055 183 0101"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={state.email}
          onChange={(event) => set('email', event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          error={errorFor('email')}
          hint="Optional"
          placeholder="you@example.com"
        />
        <Input
          label="Where is the work?"
          autoComplete="address-level2"
          value={state.location}
          onChange={(event) => set('location', event.target.value)}
          error={errorFor('location')}
          placeholder="East Legon, Accra"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="What do you need?"
          value={state.serviceId}
          onChange={(event) => set('serviceId', event.target.value)}
          error={errorFor('serviceId')}
        >
          <option value="">Not sure, please advise</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>
        <Select
          label="How soon?"
          value={state.urgency}
          onChange={(event) => set('urgency', event.target.value as Urgency)}
          options={URGENCY_LEVELS.map((level) => ({ value: level, label: URGENCY_LABELS[level] }))}
        />
      </div>

      <Textarea
        label="Tell us about the job"
        required
        rows={5}
        value={state.message}
        onChange={(event) => set('message', event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, message: true }))}
        error={errorFor('message')}
        placeholder="The pressure upstairs dropped last week and there is a damp patch on the ground floor ceiling."
        aside={
          <span
            className={cn(
              'text-xs tabular-nums',
              state.message.length > 3800 ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]',
            )}
          >
            {state.message.length} / 4000
          </span>
        }
        maxLength={4000}
      />

      <Button type="submit" variant="gold" size="lg" loading={submitting} className="mt-1 w-full">
        {submitting ? (
          'Sending your enquiry'
        ) : (
          <>
            Send enquiry
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-[var(--text-muted)]">
        We use your details only to respond to this enquiry. No marketing lists, no sharing.
      </p>
    </form>
  );
}

export function EnquiryFormFallback() {
  return (
    <div className="grid h-96 place-items-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
      <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" aria-hidden />
    </div>
  );
}
