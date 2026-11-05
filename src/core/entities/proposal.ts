import { ValidationError } from '../errors';
import { Money, type CurrencyCode } from '../value-objects/money';
import { calculateTotals, type DiscountKind, type InvoiceTotals } from './invoice';
import type { Timestamped, UUID } from './common';

export const PROPOSAL_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface ProposalItemInput {
  id?: UUID;
  section?: string | null;
  title: string;
  description?: string;
  unitOfMeasure?: string;
  quantity: number;
  unitPriceMinor: number;
  isOptional?: boolean;
  sortOrder?: number;
}

export interface ProposalItem extends ProposalItemInput {
  id: UUID;
  section: string | null;
  description: string;
  unitOfMeasure: string;
  isOptional: boolean;
  sortOrder: number;
  lineTotalMinor: number;
}

/**
 * A proposal is a letter with a priced scope attached: narrative fields carry
 * the letter, items carry the table. The money behaves exactly as it does on
 * an invoice, so the same arithmetic covers both.
 */
export interface Proposal extends Timestamped {
  id: UUID;
  proposalNumber: string;
  clientId: UUID | null;
  leadId: UUID | null;

  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;

  title: string;
  salutation: string;
  introduction: string;
  scopeIntro: string;
  closing: string;
  termsText: string;
  paymentTerms: string;
  notes: string | null;

  preparedBy: string;
  preparedByRole: string | null;

  currency: CurrencyCode;
  discountKind: DiscountKind;
  discountValue: number;
  vatRate: number;
  subtotalMinor: number;
  discountMinor: number;
  vatMinor: number;
  totalMinor: number;

  issuedOn: Date;
  validUntil: Date | null;
  status: ProposalStatus;
  sentAt: Date | null;
  respondedAt: Date | null;

  createdBy: UUID | null;
  items: ProposalItem[];
}

const MAX_ITEMS = 100;

function roundQuantity(quantity: number): number {
  return Math.round(quantity * 100) / 100;
}

export function normaliseProposalItems(
  inputs: readonly ProposalItemInput[],
  makeId: () => UUID,
): ProposalItem[] {
  if (inputs.length === 0) {
    throw new ValidationError('A proposal needs at least one line of scope');
  }
  if (inputs.length > MAX_ITEMS) {
    throw new ValidationError(`A proposal cannot carry more than ${MAX_ITEMS} lines`);
  }

  return inputs.map((input, index) => {
    const title = input.title.trim();
    if (!title) throw new ValidationError(`Line ${index + 1} needs a title`);

    const quantity = roundQuantity(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(`Line ${index + 1} needs a quantity above zero`);
    }
    if (!Number.isInteger(input.unitPriceMinor) || input.unitPriceMinor < 0) {
      throw new ValidationError(`Line ${index + 1} needs a price of zero or more`);
    }

    return {
      id: input.id ?? makeId(),
      section: input.section?.trim() || null,
      title,
      description: input.description?.trim() ?? '',
      unitOfMeasure: input.unitOfMeasure?.trim() || 'Item',
      quantity,
      unitPriceMinor: input.unitPriceMinor,
      isOptional: input.isOptional ?? false,
      sortOrder: input.sortOrder ?? index + 1,
      lineTotalMinor: Math.round(input.unitPriceMinor * quantity),
    };
  });
}

export interface ProposalTotals extends InvoiceTotals {
  /** Optional lines are quoted but sit outside the headline figure. */
  optional: Money;
}

/**
 * Optional items are deliberately excluded from the total. A client reading a
 * proposal should see one number they are being asked to approve, with the
 * extras priced separately so adding one is a decision rather than a surprise.
 */
export function calculateProposalTotals(input: {
  items: readonly ProposalItem[];
  currency: CurrencyCode;
  discountKind: DiscountKind;
  discountValue: number;
  vatRate: number;
}): ProposalTotals {
  const included = input.items.filter((item) => !item.isOptional);
  const optionalItems = input.items.filter((item) => item.isOptional);

  const totals = calculateTotals({
    lines: included.map((item) => ({
      id: item.id,
      unitOfMeasure: item.unitOfMeasure,
      description: item.title,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      sortOrder: item.sortOrder,
      lineTotalMinor: item.lineTotalMinor,
    })),
    currency: input.currency,
    discountKind: input.discountKind,
    discountValue: input.discountValue,
    vatRate: input.vatRate,
    amountPaidMinor: 0,
  });

  return {
    ...totals,
    optional: Money.sum(
      optionalItems.map((item) => Money.fromMinor(item.lineTotalMinor, input.currency)),
      input.currency,
    ),
  };
}

/** A proposal past its validity date is expired, whatever the stored status. */
export function effectiveProposalStatus(
  proposal: Pick<Proposal, 'status' | 'validUntil'>,
  now: Date = new Date(),
): ProposalStatus {
  if (proposal.status !== 'sent') return proposal.status;
  if (proposal.validUntil && proposal.validUntil.getTime() < now.getTime()) return 'expired';
  return 'sent';
}

export function assertProposalEditable(proposal: Pick<Proposal, 'status'>): void {
  if (proposal.status === 'accepted') {
    throw new ValidationError('An accepted proposal can no longer be edited');
  }
  if (proposal.status === 'declined') {
    throw new ValidationError('A declined proposal can no longer be edited');
  }
}

export const DEFAULT_PROPOSAL_TERMS = [
  'This proposal is based on the information available at the time of writing. Any change to the scope will be quoted separately before the work is carried out.',
  'Prices are held for the validity period shown above.',
  'Work begins once the proposal is accepted in writing and the agreed mobilisation payment is received.',
  'All workmanship is guaranteed, and the relevant test certificates are issued at handover.',
].join('\n');

export const DEFAULT_PAYMENT_TERMS = [
  '60% on acceptance, to cover materials and mobilisation.',
  '40% on completion and handover.',
].join('\n');
