import { ConflictError, NotFoundError, ValidationError } from '@core/errors';
import {
  assertProposalEditable,
  calculateProposalTotals,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_PROPOSAL_TERMS,
  normaliseProposalItems,
  type CurrencyCode,
  type DiscountKind,
  type Proposal,
  type ProposalItemInput,
  type ProposalStatus,
  type SessionPrincipal,
  type UUID,
} from '@core/entities';
import { EmailAddress } from '@core/value-objects/contact';
import type {
  AuditLogRepository,
  Clock,
  IdGenerator,
  LeadRepository,
  ProposalRepository,
  SettingsRepository,
} from '../ports';
import { requireRole } from './auth';

export interface ProposalDeps {
  proposals: ProposalRepository;
  leads: LeadRepository;
  settings: SettingsRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

export interface CreateProposalInput {
  clientId?: UUID | null;
  leadId?: UUID | null;
  clientName: string;
  clientCompany?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  title: string;
  salutation?: string;
  introduction?: string;
  scopeIntro?: string;
  closing?: string;
  termsText?: string;
  paymentTerms?: string;
  notes?: string | null;
  preparedBy?: string;
  preparedByRole?: string | null;
  currency?: CurrencyCode;
  discountKind?: DiscountKind;
  discountValue?: number;
  vatRate?: number;
  issuedOn?: Date;
  /** How long the price is held. Defaults to 30 days. */
  validForDays?: number;
  validUntil?: Date | null;
  items: ProposalItemInput[];
}

const DEFAULT_VALIDITY_DAYS = 30;

function addDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

/** "Dear Mr. Ebo" from a name, falling back to something never wrong. */
export function buildSalutation(name: string, company?: string | null): string {
  const trimmed = name.trim();
  if (!trimmed) return company ? `Dear ${company.trim()}` : 'Dear Sir or Madam';
  return `Dear ${trimmed}`;
}

/**
 * The letter around the pricing. Written on creation so the office has
 * something to edit rather than a blank page, and never rewritten afterwards.
 */
export function defaultProposalCopy(input: {
  companyName: string;
  clientName: string;
  title: string;
  validUntil: Date | null;
}): Pick<Proposal, 'introduction' | 'scopeIntro' | 'closing'> {
  const validity = input.validUntil
    ? ` This proposal is held until ${input.validUntil.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}.`
    : '';

  return {
    introduction: `Thank you for the opportunity to quote. We have set out below what we propose to do, what it will cost and how long it will take.${validity}`,
    scopeIntro: `The figures below cover everything needed to complete the work described. Anything outside this scope would be quoted separately before it is carried out, so there are no surprises on the final invoice.`,
    closing: `We would be glad to carry out this work for you. If any part of the proposal needs adjusting, or you would like us to walk through it in person, please say so and we will revise it.\n\nThank you for considering ${input.companyName}.`,
  };
}

async function allocateNumber(deps: ProposalDeps, issuedOn: Date): Promise<string> {
  const year = issuedOn.getUTCFullYear();
  const sequence = await deps.proposals.nextSequence(year);

  for (let attempt = sequence; attempt <= sequence + 50; attempt += 1) {
    const candidate = `PRO/${year}/${String(attempt).padStart(3, '0')}`;
    if (!(await deps.proposals.findByNumber(candidate))) return candidate;
  }
  throw new ConflictError('Could not allocate a proposal number, please try again');
}

export async function createProposal(
  deps: ProposalDeps,
  actor: SessionPrincipal,
  input: CreateProposalInput,
): Promise<Proposal> {
  requireRole(actor, 'staff');

  const settings = await deps.settings.get();
  const clientName = input.clientName.trim();
  if (!clientName) throw new ValidationError('A proposal needs a client name');

  const title = input.title.trim();
  if (!title) throw new ValidationError('A proposal needs a title');

  if (input.clientEmail) EmailAddress.create(input.clientEmail);

  const currency = input.currency ?? (settings.defaultCurrency as CurrencyCode) ?? 'GHS';
  const issuedOn = input.issuedOn ?? deps.clock.now();
  const validUntil =
    input.validUntil !== undefined
      ? input.validUntil
      : addDays(issuedOn, input.validForDays ?? DEFAULT_VALIDITY_DAYS);

  const items = normaliseProposalItems(input.items, () => deps.ids.next());
  const discountKind = input.discountKind ?? 'none';
  const discountValue = input.discountValue ?? 0;
  const vatRate = input.vatRate ?? settings.defaultVatRate ?? 0;

  const totals = calculateProposalTotals({ items, currency, discountKind, discountValue, vatRate });
  const copy = defaultProposalCopy({
    companyName: settings.companyName,
    clientName,
    title,
    validUntil,
  });

  const proposalNumber = await allocateNumber(deps, issuedOn);

  const created = await deps.proposals.create({
    id: deps.ids.next(),
    proposalNumber,
    clientId: input.clientId ?? null,
    leadId: input.leadId ?? null,
    clientName,
    clientCompany: input.clientCompany?.trim() || null,
    clientEmail: input.clientEmail?.trim().toLowerCase() || null,
    clientPhone: input.clientPhone?.trim() || null,
    clientAddress: input.clientAddress?.trim() || null,
    title,
    salutation: input.salutation?.trim() || buildSalutation(clientName, input.clientCompany),
    introduction: input.introduction?.trim() || copy.introduction,
    scopeIntro: input.scopeIntro?.trim() || copy.scopeIntro,
    closing: input.closing?.trim() || copy.closing,
    termsText: input.termsText?.trim() || DEFAULT_PROPOSAL_TERMS,
    paymentTerms: input.paymentTerms?.trim() || DEFAULT_PAYMENT_TERMS,
    notes: input.notes ?? null,
    preparedBy: input.preparedBy?.trim() || actor.name,
    preparedByRole: input.preparedByRole?.trim() || null,
    currency,
    discountKind,
    discountValue,
    vatRate,
    subtotalMinor: totals.subtotal.minorUnits,
    discountMinor: totals.discount.minorUnits,
    vatMinor: totals.vat.minorUnits,
    totalMinor: totals.total.minorUnits,
    issuedOn,
    validUntil,
    status: 'draft',
    sentAt: null,
    respondedAt: null,
    createdBy: actor.userId,
    items,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'create',
    entity: 'proposal',
    entityId: created.id,
    summary: `${actor.name} drafted proposal ${proposalNumber} for ${clientName} at ${totals.total.format()}`,
  });

  return created;
}

export type UpdateProposalInput = Partial<Omit<CreateProposalInput, 'items'>> & {
  items?: ProposalItemInput[];
};

export async function updateProposal(
  deps: ProposalDeps,
  actor: SessionPrincipal,
  id: UUID,
  input: UpdateProposalInput,
): Promise<Proposal> {
  requireRole(actor, 'staff');

  const existing = await deps.proposals.findById(id);
  if (!existing) throw new NotFoundError('Proposal', id);
  assertProposalEditable(existing);

  if (input.clientEmail) EmailAddress.create(input.clientEmail);

  const items = input.items ? normaliseProposalItems(input.items, () => deps.ids.next()) : existing.items;
  const currency = input.currency ?? existing.currency;
  const discountKind = input.discountKind ?? existing.discountKind;
  const discountValue = input.discountValue ?? existing.discountValue;
  const vatRate = input.vatRate ?? existing.vatRate;

  const totals = calculateProposalTotals({ items, currency, discountKind, discountValue, vatRate });

  const text = <K extends keyof UpdateProposalInput>(key: K) =>
    input[key] !== undefined ? { [key]: String(input[key] ?? '').trim() } : {};

  const updated = await deps.proposals.update(
    id,
    {
      ...text('clientName'),
      ...text('title'),
      ...text('salutation'),
      ...text('introduction'),
      ...text('scopeIntro'),
      ...text('closing'),
      ...text('termsText'),
      ...text('paymentTerms'),
      ...text('preparedBy'),
      ...(input.clientCompany !== undefined ? { clientCompany: input.clientCompany } : {}),
      ...(input.clientEmail !== undefined
        ? { clientEmail: input.clientEmail?.trim().toLowerCase() || null }
        : {}),
      ...(input.clientPhone !== undefined ? { clientPhone: input.clientPhone } : {}),
      ...(input.clientAddress !== undefined ? { clientAddress: input.clientAddress } : {}),
      ...(input.preparedByRole !== undefined ? { preparedByRole: input.preparedByRole } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      ...(input.issuedOn !== undefined ? { issuedOn: input.issuedOn } : {}),
      ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
      currency,
      discountKind,
      discountValue,
      vatRate,
      subtotalMinor: totals.subtotal.minorUnits,
      discountMinor: totals.discount.minorUnits,
      vatMinor: totals.vat.minorUnits,
      totalMinor: totals.total.minorUnits,
    },
    input.items ? items : undefined,
  );

  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'proposal',
    entityId: id,
    summary: `${actor.name} edited proposal ${existing.proposalNumber}`,
  });

  return updated;
}

/** Marks a proposal as issued. Sending the email is a separate step. */
export async function markProposalSent(
  deps: ProposalDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<Proposal> {
  requireRole(actor, 'staff');

  const existing = await deps.proposals.findById(id);
  if (!existing) throw new NotFoundError('Proposal', id);
  if (existing.status !== 'draft') return existing;

  const updated = await deps.proposals.update(id, {
    status: 'sent',
    sentAt: deps.clock.now(),
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'send',
    entity: 'proposal',
    entityId: id,
    summary: `${actor.name} issued proposal ${existing.proposalNumber}`,
  });

  return updated;
}

export async function recordProposalDecision(
  deps: ProposalDeps,
  actor: SessionPrincipal,
  id: UUID,
  decision: 'accepted' | 'declined',
  note?: string,
): Promise<Proposal> {
  requireRole(actor, 'staff');

  const existing = await deps.proposals.findById(id);
  if (!existing) throw new NotFoundError('Proposal', id);
  if (existing.status === 'draft') {
    throw new ValidationError('A draft proposal has not been sent, so there is nothing to decide');
  }

  const updated = await deps.proposals.update(id, {
    status: decision,
    respondedAt: deps.clock.now(),
    notes: note?.trim()
      ? `${existing.notes ? `${existing.notes}\n` : ''}${note.trim()}`
      : existing.notes,
  });

  // A won proposal closes the enquiry it came from.
  if (decision === 'accepted' && existing.leadId) {
    await deps.leads
      .update(existing.leadId, { status: 'won' })
      .catch((error) => console.error('Could not close the originating enquiry', error));
  }

  await deps.audit.record({
    actorId: actor.userId,
    action: decision,
    entity: 'proposal',
    entityId: id,
    summary: `${actor.name} recorded proposal ${existing.proposalNumber} as ${decision}`,
  });

  return updated;
}

export async function deleteProposal(
  deps: ProposalDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<void> {
  requireRole(actor, 'admin');

  const existing = await deps.proposals.findById(id);
  if (!existing) throw new NotFoundError('Proposal', id);
  if (existing.status === 'accepted') {
    throw new ValidationError('An accepted proposal is a record of agreement and cannot be deleted');
  }

  await deps.proposals.delete(id);
  await deps.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'proposal',
    entityId: id,
    summary: `${actor.name} deleted proposal ${existing.proposalNumber}`,
  });
}

/**
 * Builds a draft proposal from an enquiry, carrying the contact details and
 * what the person actually asked for into the letter.
 */
export async function draftProposalFromLead(
  deps: ProposalDeps,
  actor: SessionPrincipal,
  leadId: UUID,
  overrides: { title?: string; items?: ProposalItemInput[] } = {},
): Promise<Proposal> {
  requireRole(actor, 'staff');

  const lead = await deps.leads.findById(leadId);
  if (!lead) throw new NotFoundError('Lead', leadId);

  const title = overrides.title ?? lead.serviceName ?? 'Water and plumbing works';

  return createProposal(deps, actor, {
    leadId: lead.id,
    clientId: lead.clientId,
    clientName: lead.fullName,
    clientEmail: lead.email,
    clientPhone: lead.phone,
    clientAddress: lead.location || null,
    title,
    scopeIntro: `Following your enquiry of ${lead.createdAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}, in which you told us:\n\n"${lead.message.trim()}"\n\nwe propose the following.`,
    items:
      overrides.items && overrides.items.length > 0
        ? overrides.items
        : [
            {
              title,
              description: 'To be priced after the site visit.',
              quantity: 1,
              unitPriceMinor: 0,
            },
          ],
  });
}

export type { ProposalStatus };
