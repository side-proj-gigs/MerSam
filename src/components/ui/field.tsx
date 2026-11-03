'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] transition-colors duration-150 placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60';
const CONTROL_OK = 'border-[var(--border-strong)] hover:border-[var(--color-ink-400)]';
const CONTROL_BAD = 'border-[var(--color-danger)]';

export interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
  /** Shown at the right of the label row, for counters and inline actions. */
  aside?: ReactNode;
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
  aside,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label
              htmlFor={htmlFor}
              className="text-[0.8125rem] font-semibold text-[var(--text-primary)]"
            >
              {label}
              {required && (
                <span className="ml-0.5 text-[var(--color-danger)]" aria-hidden>
                  *
                </span>
              )}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  aside?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leadingIcon, aside, wrapperClassName, className, id, required, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={wrapperClassName}
      aside={aside}
    >
      <div className="relative">
        {leadingIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          >
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(CONTROL, error ? CONTROL_BAD : CONTROL_OK, leadingIcon && 'pl-10', className)}
          {...props}
        />
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  aside?: ReactNode;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, aside, wrapperClassName, className, id, required, rows = 4, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={wrapperClassName}
      aside={aside}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, error ? CONTROL_BAD : CONTROL_OK, 'resize-y leading-relaxed', className)}
        {...props}
      />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  options?: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, wrapperClassName, className, id, required, options, children, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={wrapperClassName}
    >
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          error ? CONTROL_BAD : CONTROL_OK,
          'appearance-none bg-[length:1.1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7689' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <label
      htmlFor={fieldId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--surface-sunken)]',
        className,
      )}
    >
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        {...props}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {description && <span className="text-xs text-[var(--text-muted)]">{description}</span>}
      </span>
    </label>
  );
});
