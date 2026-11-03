import { ValidationError } from '../errors';
import { Money, type CurrencyCode } from '../value-objects/money';
import type { Timestamped, UUID } from './common';

export const PAYMENT_METHODS = [
  'cash',
  'mobile_money',
  'bank_transfer',
  'cheque',
  'card',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

export interface Payment extends Timestamped {
  id: UUID;
  invoiceId: UUID | null;
  jobId: UUID | null;
  clientId: UUID | null;
  amountMinor: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  reference: string | null;
  paidOn: Date;
  note: string | null;
  recordedBy: UUID | null;
}

export const PAYMENT_STATES = ['fully_paid', 'part_payment', 'unpaid'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  fully_paid: 'FULLY PAID',
  part_payment: 'PART PAYMENT RECEIVED',
  unpaid: 'PAYMENT OUTSTANDING',
};

export function derivePaymentState(totalMinor: number, paidMinor: number): PaymentState {
  if (paidMinor <= 0) return 'unpaid';
  if (paidMinor >= totalMinor) return 'fully_paid';
  return 'part_payment';
}

export interface WorkReportCostLine {
  id: UUID;
  description: string;
  amountMinor: number;
  sortOrder: number;
}

export const WORK_REPORT_STATUSES = ['draft', 'issued', 'archived'] as const;
export type WorkReportStatus = (typeof WORK_REPORT_STATUSES)[number];

/**
 * Mirrors the signed template: numbered sections, a cost table, a payment
 * confirmation and a signature block. Every narrative section is editable so
 * the office can keep the wording it already uses with clients.
 */
export interface WorkReport extends Timestamped {
  id: UUID;
  reportNumber: string;
  jobId: UUID | null;
  clientId: UUID | null;
  invoiceId: UUID | null;
  clientName: string;
  serviceCategory: string;
  title: string;
  dateOfWork: Date;
  reportDate: Date;
  currency: CurrencyCode;
  introduction: string;
  workPerformed: string;
  completionNote: string;
  paymentNote: string;
  appreciation: string;
  preparedBy: string;
  authorisedRepresentative: string | null;
  signatureImageUrl: string | null;
  photoUrls: string[];
  costLines: WorkReportCostLine[];
  totalCostMinor: number;
  totalPaidMinor: number;
  outstandingMinor: number;
  paymentState: PaymentState;
  status: WorkReportStatus;
  createdBy: UUID | null;
}

export function normaliseCostLines(
  inputs: readonly { id?: UUID; description: string; amountMinor: number; sortOrder?: number }[],
  makeId: () => UUID,
): WorkReportCostLine[] {
  if (inputs.length === 0) {
    throw new ValidationError('A work report needs at least one cost line');
  }
  return inputs.map((input, index) => {
    const description = input.description.trim();
    if (!description) throw new ValidationError(`Cost line ${index + 1} needs a description`);
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
      throw new ValidationError(`Cost line ${index + 1} needs an amount of zero or more`);
    }
    return {
      id: input.id ?? makeId(),
      description,
      amountMinor: input.amountMinor,
      sortOrder: input.sortOrder ?? index + 1,
    };
  });
}

export function calculateWorkReportTotals(
  costLines: readonly WorkReportCostLine[],
  totalPaidMinor: number,
  currency: CurrencyCode = 'GHS',
): { totalCost: Money; totalPaid: Money; outstanding: Money; state: PaymentState } {
  const totalCost = Money.sum(
    costLines.map((line) => Money.fromMinor(line.amountMinor, currency)),
    currency,
  );
  const totalPaid = Money.fromMinor(Math.max(0, Math.round(totalPaidMinor)), currency);
  const outstanding = totalCost.minus(totalPaid).clampAtZero();
  return {
    totalCost,
    totalPaid,
    outstanding,
    state: derivePaymentState(totalCost.minorUnits, totalPaid.minorUnits),
  };
}
