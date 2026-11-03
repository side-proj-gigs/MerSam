import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const SYMBOLS: Record<string, string> = {
  GHS: 'GH₵',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/** Mirrors Money.format on the client, where the value arrives as minor units. */
export function formatMoney(minorUnits: number, currency = 'GHS'): string {
  const negative = minorUnits < 0;
  const absolute = Math.abs(Math.round(minorUnits));
  const whole = Math.floor(absolute / 100).toLocaleString('en-US');
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${SYMBOLS[currency] ?? ''}${whole}.${fraction}`;
}

export function formatMoneyPlain(minorUnits: number): string {
  const absolute = Math.abs(Math.round(minorUnits));
  const whole = Math.floor(absolute / 100).toLocaleString('en-US');
  return `${minorUnits < 0 ? '-' : ''}${whole}.${String(absolute % 100).padStart(2, '0')}`;
}

/** Turns "1,100.50" from an input field into 110050 minor units. */
export function parseMoneyToMinor(input: string): number {
  const cleaned = input.replace(/[^\d.-]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

const DATE_FORMATS = {
  short: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDate(
  value: Date | string | null | undefined,
  style: keyof typeof DATE_FORMATS = 'short',
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', DATE_FORMATS[style]);
}

/** "2 days ago", used in activity feeds where the exact time adds nothing. */
export function formatRelative(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let previous = 1;
  for (const [limit, unit] of steps) {
    if (Math.abs(seconds) < limit) return formatter.format(-Math.round(seconds / previous), unit);
    previous = limit;
  }
  return formatter.format(-Math.round(seconds / 31557600), 'year');
}

/** Form field values arrive as strings, dates need 'YYYY-MM-DD'. */
export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A key the server can use to collapse a retried write onto the first attempt.
 * Generated once per form submission, not per render.
 */
export function newIdempotencyKey(prefix = 'req'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random.replace(/-/g, '').slice(0, 24)}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}

/** Splits seeded body copy into paragraphs without pulling in a Markdown parser. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}
