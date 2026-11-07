'use client';

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks';
import { Button } from './button';

/* ----------------------------------------------------------------- surface */

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-lift)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4', className)}>
      <div className="min-w-0">
        <h3 className="truncate font-sans text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          {title}
        </h3>
        {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ status */

type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  brand: 'bg-gold-500/12 text-gold-700 border-gold-500/25 dark:text-gold-300',
  accent: 'bg-aqua-500/12 text-aqua-700 border-aqua-500/25 dark:text-aqua-300',
  success: 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]',
  warning: 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]',
  danger: 'bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** One mapping from a stored status to its label and colour, used everywhere. */
export const STATUS_TONES: Record<string, Tone> = {
  draft: 'neutral',
  sent: 'accent',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
  void: 'neutral',
  new: 'accent',
  contacted: 'warning',
  quoted: 'brand',
  won: 'success',
  lost: 'danger',
  archived: 'neutral',
  scheduled: 'accent',
  in_progress: 'warning',
  on_hold: 'neutral',
  completed: 'success',
  cancelled: 'danger',
  issued: 'success',
  fully_paid: 'success',
  part_payment: 'warning',
  unpaid: 'danger',
  accepted: 'success',
  declined: 'danger',
  expired: 'warning',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

/* ---------------------------------------------------------------- loading */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--text-muted)]">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <div>
        <p className="font-sans text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- dialog */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;

      // Keep focus inside the dialog while it is open.
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => {
      // A dialog may nominate where the keyboard should land. A destructive
      // confirmation puts it on Cancel, so a stray Enter does nothing.
      const nominated = panel.current?.querySelector<HTMLElement>('[data-autofocus]');
      (nominated ?? panel.current?.querySelector<HTMLElement>('input, textarea, select, button'))
        ?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
        tabIndex={-1}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-float)] sm:rounded-3xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-sans text-base font-semibold text-[var(--text-primary)]">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- pagination */

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return (
      <p className="px-1 py-3 text-xs text-[var(--text-muted)]">
        {total.toLocaleString('en-US')} {total === 1 ? 'record' : 'records'}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <p className="text-xs text-[var(--text-muted)]">
        Page {page} of {pageCount}, {total.toLocaleString('en-US')} records
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
