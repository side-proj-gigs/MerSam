import { InvariantViolation, ValidationError } from '../errors';
import { Money, type CurrencyCode } from '../value-objects/money';
import type { Timestamped, UUID } from './common';

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'void',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DISCOUNT_KINDS = ['none', 'fixed', 'percentage'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export interface InvoiceLineInput {
  id?: UUID;
  unitOfMeasure: string;
  description: string;
  /** Quantities support two decimals so metres and hours both work. */
  quantity: number;
  unitPriceMinor: number;
  sortOrder?: number;
}

export interface InvoiceLine extends InvoiceLineInput {
  id: UUID;
  sortOrder: number;
  lineTotalMinor: number;
}

export interface InvoiceRecord extends Timestamped {
  id: UUID;
  invoiceNumber: string;
  customerReference: string;
  clientId: UUID | null;
  jobId: UUID | null;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  currency: CurrencyCode;
  issuedOn: Date;
  dueOn: Date | null;
  status: InvoiceStatus;
  discountKind: DiscountKind;
  /** Minor units when the kind is fixed, basis points of a percent otherwise. */
  discountValue: number;
  vatRate: number;
  termsText: string;
  paymentDetails: string;
  notes: string | null;
  subtotalMinor: number;
  discountMinor: number;
  vatMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  sentAt: Date | null;
  voidedAt: Date | null;
  createdBy: UUID | null;
  lines: InvoiceLine[];
}

export interface InvoiceTotals {
  subtotal: Money;
  discount: Money;
  taxable: Money;
  vat: Money;
  total: Money;
  amountPaid: Money;
  balance: Money;
}

const MAX_LINES = 200;

function roundQuantity(quantity: number): number {
  return Math.round(quantity * 100) / 100;
}

export function computeLineTotalMinor(line: Pick<InvoiceLineInput, 'quantity' | 'unitPriceMinor'>): number {
  return Math.round(line.unitPriceMinor * roundQuantity(line.quantity));
}

export function normaliseLines(inputs: readonly InvoiceLineInput[], makeId: () => UUID): InvoiceLine[] {
  if (inputs.length === 0) {
    throw new ValidationError('An invoice needs at least one line item');
  }
  if (inputs.length > MAX_LINES) {
    throw new ValidationError(`An invoice cannot carry more than ${MAX_LINES} line items`);
  }

  return inputs.map((input, index) => {
    const description = input.description.trim();
    if (!description) {
      throw new ValidationError(`Line ${index + 1} needs a description`);
    }
    const quantity = roundQuantity(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(`Line ${index + 1} needs a quantity above zero`);
    }
    if (!Number.isInteger(input.unitPriceMinor) || input.unitPriceMinor < 0) {
      throw new ValidationError(`Line ${index + 1} needs a unit price of zero or more`);
    }

    return {
      id: input.id ?? makeId(),
      unitOfMeasure: input.unitOfMeasure.trim() || 'Pcs',
      description,
      quantity,
      unitPriceMinor: input.unitPriceMinor,
      sortOrder: input.sortOrder ?? index + 1,
      lineTotalMinor: computeLineTotalMinor({ quantity, unitPriceMinor: input.unitPriceMinor }),
    };
  });
}

/**
 * Totals are always derived, never trusted from the client. The stored columns
 * exist so the admin list can sort and sum without rehydrating every aggregate.
 */
export function calculateTotals(input: {
  lines: readonly InvoiceLine[];
  currency: CurrencyCode;
  discountKind: DiscountKind;
  discountValue: number;
  vatRate: number;
  amountPaidMinor: number;
}): InvoiceTotals {
  const { currency } = input;
  const subtotal = Money.sum(
    input.lines.map((line) => Money.fromMinor(line.lineTotalMinor, currency)),
    currency,
  );

  let discount = Money.zero(currency);
  if (input.discountKind === 'fixed') {
    discount = Money.fromMinor(Math.max(0, Math.round(input.discountValue)), currency);
  } else if (input.discountKind === 'percentage') {
    if (input.discountValue < 0 || input.discountValue > 100) {
      throw new InvariantViolation('A percentage discount must sit between 0 and 100');
    }
    discount = subtotal.percentage(input.discountValue);
  }
  if (discount.greaterThan(subtotal)) discount = subtotal;

  const taxable = subtotal.minus(discount);

  if (input.vatRate < 0 || input.vatRate > 100) {
    throw new InvariantViolation('A VAT rate must sit between 0 and 100');
  }
  const vat = taxable.percentage(input.vatRate);
  const total = taxable.plus(vat);
  const amountPaid = Money.fromMinor(Math.max(0, Math.round(input.amountPaidMinor)), currency);
  const balance = total.minus(amountPaid).clampAtZero();

  return { subtotal, discount, taxable, vat, total, amountPaid, balance };
}

/**
 * Status follows the money rather than being set by hand, with two exceptions:
 * a draft stays a draft until it is sent, and a void invoice stays void.
 */
export function deriveStatus(
  current: InvoiceStatus,
  totals: InvoiceTotals,
  dueOn: Date | null,
  now: Date = new Date(),
): InvoiceStatus {
  if (current === 'void' || current === 'draft') return current;
  if (totals.total.isZero()) return 'paid';
  if (!totals.balance.isZero() && totals.amountPaid.isZero()) {
    return dueOn && dueOn.getTime() < now.getTime() ? 'overdue' : 'sent';
  }
  if (totals.balance.isZero()) return 'paid';
  return dueOn && dueOn.getTime() < now.getTime() ? 'overdue' : 'partially_paid';
}

export function assertEditable(invoice: Pick<InvoiceRecord, 'status'>): void {
  if (invoice.status === 'void') {
    throw new InvariantViolation('A void invoice can no longer be edited');
  }
  if (invoice.status === 'paid') {
    throw new InvariantViolation('A settled invoice can no longer be edited, raise a credit note instead');
  }
}

export const DEFAULT_INVOICE_TERMS = [
  'As per agreed Terms and Conditions.',
  'Please do not hesitate to contact us should you have any concerns. Delivery of order should be within the stipulated time of receipt of payment.',
  'Orders are deemed confirmed after 2 hours if not cancelled.',
  'This invoice is valid for 7 days from date of issuance.',
].join('\n');
