'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--text-primary)] text-[var(--text-inverse)] hover:bg-[var(--color-ink-700)] active:bg-[var(--color-ink-800)]',
  // The brand button: metallic gold with a highlight that sweeps on hover.
  gold: 'edge-gold relative overflow-hidden bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 text-ink-950 shadow-[0_8px_24px_-10px_rgba(201,162,39,0.8)] hover:from-gold-300 hover:via-gold-400 hover:to-gold-600',
  secondary:
    'bg-[var(--surface-sunken)] text-[var(--text-primary)] hairline hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)]',
  outline:
    'border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-95',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.8125rem] gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
};

const BASE =
  'inline-flex items-center justify-center font-semibold tracking-[-0.01em] whitespace-nowrap transition-all duration-200 ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, leadingIcon, trailingIcon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

export interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  leadingIcon,
  trailingIcon,
  ...props
}: ButtonLinkProps) {
  const isExternal = href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:');
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (isExternal) {
    return (
      <a href={href} className={classes} {...props}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
