import { describe, expect, it } from 'vitest';
import {
  assertEditable,
  calculateTotals,
  calculateWorkReportTotals,
  derivePaymentState,
  deriveStatus,
  normaliseCostLines,
  normaliseLines,
} from '../../src/core/entities';
import { InvariantViolation, ValidationError } from '../../src/core/errors';

let counter = 0;
const makeId = () => `id-${(counter += 1)}`;

const line = (description: string, quantity: number, unitPriceMinor: number) => ({
  unitOfMeasure: 'Pcs',
  description,
  quantity,
  unitPriceMinor,
});

describe('invoice line normalisation', () => {
  it('computes the line total and assigns an order', () => {
    const [first] = normaliseLines([line('3/4" PPR Pipe', 25, 4400)], makeId);
    expect(first!.lineTotalMinor).toBe(110000);
    expect(first!.sortOrder).toBe(1);
  });

  it('allows fractional quantities for metres and hours', () => {
    const [first] = normaliseLines([line('Trenching', 12.5, 8000)], makeId);
    expect(first!.lineTotalMinor).toBe(100000);
  });

  it('rejects an empty invoice, a blank description and a zero quantity', () => {
    expect(() => normaliseLines([], makeId)).toThrow(ValidationError);
    expect(() => normaliseLines([line('   ', 1, 100)], makeId)).toThrow(ValidationError);
    expect(() => normaliseLines([line('Pipe', 0, 100)], makeId)).toThrow(ValidationError);
    expect(() => normaliseLines([line('Pipe', -2, 100)], makeId)).toThrow(ValidationError);
  });
});

describe('invoice totals', () => {
  const lines = normaliseLines([line('Pipe', 10, 10000), line('Workmanship', 1, 500000)], makeId);

  it('sums the lines when there is no discount or VAT', () => {
    const totals = calculateTotals({
      lines,
      currency: 'GHS',
      discountKind: 'none',
      discountValue: 0,
      vatRate: 0,
      amountPaidMinor: 0,
    });

    expect(totals.subtotal.minorUnits).toBe(600000);
    expect(totals.total.minorUnits).toBe(600000);
    expect(totals.balance.minorUnits).toBe(600000);
  });

  it('applies a percentage discount before VAT', () => {
    const totals = calculateTotals({
      lines,
      currency: 'GHS',
      discountKind: 'percentage',
      discountValue: 10,
      vatRate: 15,
      amountPaidMinor: 0,
    });

    expect(totals.discount.minorUnits).toBe(60000);
    expect(totals.taxable.minorUnits).toBe(540000);
    expect(totals.vat.minorUnits).toBe(81000);
    expect(totals.total.minorUnits).toBe(621000);
  });

  it('never lets a discount exceed the sub-total', () => {
    const totals = calculateTotals({
      lines,
      currency: 'GHS',
      discountKind: 'fixed',
      discountValue: 10_000_000,
      vatRate: 0,
      amountPaidMinor: 0,
    });

    expect(totals.discount.minorUnits).toBe(600000);
    expect(totals.total.minorUnits).toBe(0);
  });

  it('refuses an impossible discount or VAT rate', () => {
    const base = { lines, currency: 'GHS' as const, amountPaidMinor: 0 };
    expect(() =>
      calculateTotals({ ...base, discountKind: 'percentage', discountValue: 140, vatRate: 0 }),
    ).toThrow(InvariantViolation);
    expect(() =>
      calculateTotals({ ...base, discountKind: 'none', discountValue: 0, vatRate: 101 }),
    ).toThrow(InvariantViolation);
  });

  it('clamps the balance at zero when overpaid', () => {
    const totals = calculateTotals({
      lines,
      currency: 'GHS',
      discountKind: 'none',
      discountValue: 0,
      vatRate: 0,
      amountPaidMinor: 900000,
    });

    expect(totals.balance.minorUnits).toBe(0);
  });
});

describe('invoice status', () => {
  const totals = (paid: number) =>
    calculateTotals({
      lines: normaliseLines([line('Work', 1, 100000)], makeId),
      currency: 'GHS',
      discountKind: 'none',
      discountValue: 0,
      vatRate: 0,
      amountPaidMinor: paid,
    });

  const past = new Date('2020-01-01');
  const future = new Date('2099-01-01');
  const now = new Date('2026-06-01');

  it('leaves a draft and a void invoice alone', () => {
    expect(deriveStatus('draft', totals(100000), null, now)).toBe('draft');
    expect(deriveStatus('void', totals(0), null, now)).toBe('void');
  });

  it('moves through sent, partially paid and paid', () => {
    expect(deriveStatus('sent', totals(0), future, now)).toBe('sent');
    expect(deriveStatus('sent', totals(40000), future, now)).toBe('partially_paid');
    expect(deriveStatus('sent', totals(100000), future, now)).toBe('paid');
  });

  it('marks an unpaid invoice overdue once the due date passes', () => {
    expect(deriveStatus('sent', totals(0), past, now)).toBe('overdue');
    expect(deriveStatus('sent', totals(40000), past, now)).toBe('overdue');
    // Settling it clears the overdue state.
    expect(deriveStatus('overdue', totals(100000), past, now)).toBe('paid');
  });

  it('blocks edits to a void or settled invoice', () => {
    expect(() => assertEditable({ status: 'void' })).toThrow(InvariantViolation);
    expect(() => assertEditable({ status: 'paid' })).toThrow(InvariantViolation);
    expect(() => assertEditable({ status: 'sent' })).not.toThrow();
  });
});

describe('work report totals', () => {
  it('reproduces the signed Shola report', () => {
    const costs = normaliseCostLines(
      [{ description: 'Labour cost for sewage pipe unblocking', amountMinor: 280000 }],
      makeId,
    );
    const totals = calculateWorkReportTotals(costs, 280000, 'GHS');

    expect(totals.totalCost.formatPlain()).toBe('2,800.00');
    expect(totals.outstanding.minorUnits).toBe(0);
    expect(totals.state).toBe('fully_paid');
  });

  it('reports a part payment and an outstanding balance', () => {
    const costs = normaliseCostLines(
      [
        { description: 'Materials', amountMinor: 150000 },
        { description: 'Labour', amountMinor: 250000 },
      ],
      makeId,
    );
    const totals = calculateWorkReportTotals(costs, 100000, 'GHS');

    expect(totals.totalCost.minorUnits).toBe(400000);
    expect(totals.outstanding.minorUnits).toBe(300000);
    expect(totals.state).toBe('part_payment');
  });

  it('derives the payment state from the figures alone', () => {
    expect(derivePaymentState(1000, 0)).toBe('unpaid');
    expect(derivePaymentState(1000, 400)).toBe('part_payment');
    expect(derivePaymentState(1000, 1000)).toBe('fully_paid');
    expect(derivePaymentState(1000, 1500)).toBe('fully_paid');
  });

  it('requires at least one cost line', () => {
    expect(() => normaliseCostLines([], makeId)).toThrow(ValidationError);
  });
});
