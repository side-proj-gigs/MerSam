import { InvariantViolation } from '../errors';

/**
 * Money is held as an integer count of minor units (pesewas for GHS). Every
 * figure that reaches the database, a PDF or the browser travels as an integer
 * so no rounding drift can accumulate across a long invoice.
 */
export type CurrencyCode = 'GHS' | 'USD' | 'EUR' | 'GBP';

const SYMBOLS: Record<CurrencyCode, string> = {
  GHS: 'GH\u20B5',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

export class Money {
  private constructor(
    readonly minorUnits: number,
    readonly currency: CurrencyCode,
  ) {}

  static zero(currency: CurrencyCode = 'GHS'): Money {
    return new Money(0, currency);
  }

  static fromMinor(minorUnits: number, currency: CurrencyCode = 'GHS'): Money {
    if (!Number.isInteger(minorUnits)) {
      throw new InvariantViolation(`Money requires whole minor units, received ${minorUnits}`);
    }
    if (!Number.isSafeInteger(minorUnits)) {
      throw new InvariantViolation('Money amount is outside the safe integer range');
    }
    return new Money(minorUnits, currency);
  }

  /** Accepts a decimal figure as typed by a human, for example 1100.5 */
  static fromMajor(amount: number, currency: CurrencyCode = 'GHS'): Money {
    if (!Number.isFinite(amount)) {
      throw new InvariantViolation('Money amount must be a finite number');
    }
    return new Money(Math.round(amount * 100), currency);
  }

  get majorUnits(): number {
    return this.minorUnits / 100;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new InvariantViolation(
        `Cannot combine ${this.currency} with ${other.currency} without a conversion rate`,
      );
    }
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinor(this.minorUnits + other.minorUnits, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinor(this.minorUnits - other.minorUnits, this.currency);
  }

  /** Banker-free half-up rounding, which is what invoice readers expect. */
  times(multiplier: number): Money {
    if (!Number.isFinite(multiplier)) {
      throw new InvariantViolation('Multiplier must be a finite number');
    }
    return Money.fromMinor(Math.round(this.minorUnits * multiplier), this.currency);
  }

  percentage(rate: number): Money {
    return this.times(rate / 100);
  }

  isZero(): boolean {
    return this.minorUnits === 0;
  }

  isNegative(): boolean {
    return this.minorUnits < 0;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.minorUnits > other.minorUnits;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  clampAtZero(): Money {
    return this.isNegative() ? Money.zero(this.currency) : this;
  }

  /** "19,830.00" with no currency marker, matching the invoice table columns. */
  formatPlain(): string {
    const negative = this.minorUnits < 0;
    const absolute = Math.abs(this.minorUnits);
    const whole = Math.floor(absolute / 100).toLocaleString('en-US');
    const fraction = String(absolute % 100).padStart(2, '0');
    return `${negative ? '-' : ''}${whole}.${fraction}`;
  }

  /** "GH\u20B519,830.00" for totals and status chips. */
  format(): string {
    return `${SYMBOLS[this.currency]}${this.formatPlain()}`;
  }

  static sum(values: readonly Money[], currency: CurrencyCode = 'GHS'): Money {
    return values.reduce<Money>((total, value) => total.plus(value), Money.zero(currency));
  }
}

export function currencySymbol(currency: CurrencyCode): string {
  return SYMBOLS[currency];
}
