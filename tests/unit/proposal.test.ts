import { describe, expect, it } from 'vitest';
import {
  assertProposalEditable,
  calculateProposalTotals,
  effectiveProposalStatus,
  normaliseProposalItems,
} from '../../src/core/entities';
import { ValidationError } from '../../src/core/errors';

let counter = 0;
const makeId = () => `item-${(counter += 1)}`;

const item = (
  title: string,
  quantity: number,
  unitPriceMinor: number,
  extra: { isOptional?: boolean; section?: string } = {},
) => ({ title, quantity, unitPriceMinor, ...extra });

const totalsFor = (
  items: ReturnType<typeof normaliseProposalItems>,
  overrides: Partial<{ discountKind: 'none' | 'fixed' | 'percentage'; discountValue: number; vatRate: number }> = {},
) =>
  calculateProposalTotals({
    items,
    currency: 'GHS',
    discountKind: overrides.discountKind ?? 'none',
    discountValue: overrides.discountValue ?? 0,
    vatRate: overrides.vatRate ?? 0,
  });

describe('proposal item normalisation', () => {
  it('computes each line total and keeps the order given', () => {
    const items = normaliseProposalItems(
      [item('Borehole drilling, 60m', 1, 4_500_000), item('Submersible pump', 2, 850_000)],
      makeId,
    );

    expect(items[0]!.lineTotalMinor).toBe(4_500_000);
    expect(items[1]!.lineTotalMinor).toBe(1_700_000);
    expect(items.map((line) => line.sortOrder)).toEqual([1, 2]);
  });

  it('defaults the optional flag and the section to something harmless', () => {
    const [only] = normaliseProposalItems([item('Site survey', 1, 120_000)], makeId);
    expect(only!.isOptional).toBe(false);
    expect(only!.section).toBeNull();
    expect(only!.description).toBe('');
  });

  it('refuses a proposal with no scope at all', () => {
    expect(() => normaliseProposalItems([], makeId)).toThrow(ValidationError);
  });
});

describe('proposal totals', () => {
  it('adds up the included lines', () => {
    const totals = totalsFor(
      normaliseProposalItems(
        [item('Treatment plant', 1, 5_000_000), item('Pipework', 1, 1_200_000)],
        makeId,
      ),
    );

    expect(totals.subtotal.minorUnits).toBe(6_200_000);
    expect(totals.total.minorUnits).toBe(6_200_000);
  });

  it('leaves optional extras out of the headline figure and reports them separately', () => {
    const totals = totalsFor(
      normaliseProposalItems(
        [
          item('Reverse osmosis skid', 1, 7_000_000),
          item('Annual service contract', 1, 900_000, { isOptional: true }),
          item('Spare membrane set', 2, 250_000, { isOptional: true }),
        ],
        makeId,
      ),
    );

    // The client sees GHS 70,000.00 as the price, with 14,000.00 on offer beside it.
    expect(totals.total.minorUnits).toBe(7_000_000);
    expect(totals.optional.minorUnits).toBe(1_400_000);
  });

  it('applies a discount before VAT, as the invoice does', () => {
    const totals = totalsFor(
      normaliseProposalItems([item('Community standpipes', 10, 100_000)], makeId),
      { discountKind: 'percentage', discountValue: 10, vatRate: 15 },
    );

    expect(totals.subtotal.minorUnits).toBe(1_000_000);
    expect(totals.discount.minorUnits).toBe(100_000);
    expect(totals.vat.minorUnits).toBe(135_000);
    expect(totals.total.minorUnits).toBe(1_035_000);
  });

  it('does not let an optional line attract VAT in the quoted total', () => {
    const withOptional = totalsFor(
      normaliseProposalItems(
        [item('Pump house', 1, 2_000_000), item('Generator', 1, 3_000_000, { isOptional: true })],
        makeId,
      ),
      { vatRate: 15 },
    );
    const withoutOptional = totalsFor(
      normaliseProposalItems([item('Pump house', 1, 2_000_000)], makeId),
      { vatRate: 15 },
    );

    expect(withOptional.total.minorUnits).toBe(withoutOptional.total.minorUnits);
  });

  it('returns zero of everything when every line is optional', () => {
    const totals = totalsFor(
      normaliseProposalItems([item('Nice to have', 1, 500_000, { isOptional: true })], makeId),
    );

    expect(totals.total.isZero()).toBe(true);
    expect(totals.optional.minorUnits).toBe(500_000);
  });
});

describe('proposal status', () => {
  const dates = {
    past: new Date('2026-01-01T00:00:00Z'),
    future: new Date('2099-01-01T00:00:00Z'),
  };

  it('reads a sent proposal as expired once its validity has passed', () => {
    expect(effectiveProposalStatus({ status: 'sent', validUntil: dates.past })).toBe('expired');
  });

  it('leaves a sent proposal alone while it is still valid', () => {
    expect(effectiveProposalStatus({ status: 'sent', validUntil: dates.future })).toBe('sent');
  });

  it('treats a sent proposal with no end date as still open', () => {
    expect(effectiveProposalStatus({ status: 'sent', validUntil: null })).toBe('sent');
  });

  it('never expires a proposal the client already answered', () => {
    expect(effectiveProposalStatus({ status: 'accepted', validUntil: dates.past })).toBe('accepted');
    expect(effectiveProposalStatus({ status: 'declined', validUntil: dates.past })).toBe('declined');
  });

  it('leaves a draft as a draft, however old', () => {
    expect(effectiveProposalStatus({ status: 'draft', validUntil: dates.past })).toBe('draft');
  });
});

describe('proposal editability', () => {
  it('allows a draft and a sent proposal to be changed', () => {
    expect(() => assertProposalEditable({ status: 'draft' })).not.toThrow();
    expect(() => assertProposalEditable({ status: 'sent' })).not.toThrow();
  });

  it('locks a proposal once the client has answered', () => {
    expect(() => assertProposalEditable({ status: 'accepted' })).toThrow(ValidationError);
    expect(() => assertProposalEditable({ status: 'declined' })).toThrow(ValidationError);
  });
});
