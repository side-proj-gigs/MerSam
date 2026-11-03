import { describe, expect, it } from 'vitest';
import { Money } from '../../src/core/value-objects/money';
import { InvariantViolation } from '../../src/core/errors';

describe('Money', () => {
  it('holds whole minor units and rejects fractions of one', () => {
    expect(Money.fromMinor(110000).minorUnits).toBe(110000);
    expect(() => Money.fromMinor(10.5)).toThrow(InvariantViolation);
  });

  it('converts a decimal the way a person would type it', () => {
    expect(Money.fromMajor(1100.5).minorUnits).toBe(110050);
    expect(Money.fromMajor(44).minorUnits).toBe(4400);
    // The classic float trap: 0.1 + 0.2 in cedis.
    expect(Money.fromMajor(0.1).plus(Money.fromMajor(0.2)).minorUnits).toBe(30);
  });

  it('formats in the Ghanaian convention', () => {
    expect(Money.fromMinor(1983000).formatPlain()).toBe('19,830.00');
    expect(Money.fromMinor(1983000).format()).toBe('GH₵19,830.00');
    expect(Money.fromMinor(5).formatPlain()).toBe('0.05');
    expect(Money.fromMinor(-2500).formatPlain()).toBe('-25.00');
  });

  it('refuses to mix currencies without a rate', () => {
    expect(() => Money.fromMinor(100, 'GHS').plus(Money.fromMinor(100, 'USD'))).toThrow(
      InvariantViolation,
    );
  });

  it('rounds a percentage half up, as an invoice reader expects', () => {
    // 15% of 1.03 is 0.1545, which must present as 0.15 rather than 0.154999
    expect(Money.fromMajor(1.03).percentage(15).minorUnits).toBe(15);
    expect(Money.fromMajor(100).percentage(12.5).minorUnits).toBe(1250);
  });

  it('sums a list without drifting', () => {
    const lines = Array.from({ length: 1000 }, () => Money.fromMajor(0.01));
    expect(Money.sum(lines).minorUnits).toBe(1000);
    expect(Money.sum(lines).formatPlain()).toBe('10.00');
  });

  it('clamps a negative balance at zero', () => {
    expect(Money.fromMinor(-500).clampAtZero().isZero()).toBe(true);
    expect(Money.fromMinor(500).clampAtZero().minorUnits).toBe(500);
  });

  it('reproduces the total on the signed Mr. Ebo invoice', () => {
    const lines: [number, number][] = [
      [25, 4400], [3, 3000], [30, 300], [30, 1000], [3, 2000], [33, 300],
      [5, 7000], [26, 300], [25, 300], [20, 300], [15, 40000], [14, 2000],
      [12, 2500], [9, 18000], [16, 800], [9, 1000], [3, 7000], [14, 700],
      [8, 600], [6, 500], [6, 400], [10, 7000], [1, 800000],
    ];

    const total = Money.sum(
      lines.map(([quantity, unitPrice]) => Money.fromMinor(unitPrice).times(quantity)),
    );

    expect(total.formatPlain()).toBe('19,830.00');
  });
});
