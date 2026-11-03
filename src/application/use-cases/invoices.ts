import { ConflictError, NotFoundError, ValidationError } from '@core/errors';
import {
  assertEditable,
  calculateTotals,
  deriveStatus,
  normaliseLines,
  type DiscountKind,
  type InvoiceLineInput,
  type InvoiceRecord,
  type Payment,
  type PaymentMethod,
  type SessionPrincipal,
  type UUID,
} from '@core/entities';
import { DocumentNumber } from '@core/value-objects/identifiers';
import { Money, type CurrencyCode } from '@core/value-objects/money';
import type {
  AuditLogRepository,
  Clock,
  IdGenerator,
  InvoiceRepository,
  PaymentRepository,
  SettingsRepository,
} from '../ports';
import { requireRole } from './auth';

export interface InvoiceDeps {
  invoices: InvoiceRepository;
  payments: PaymentRepository;
  settings: SettingsRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

export interface CreateInvoiceInput {
  clientId?: UUID | null;
  jobId?: UUID | null;
  customerName: string;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  currency?: CurrencyCode;
  issuedOn?: Date;
  dueOn?: Date | null;
  discountKind?: DiscountKind;
  discountValue?: number;
  vatRate?: number;
  termsText?: string;
  paymentDetails?: string;
  notes?: string | null;
  lines: InvoiceLineInput[];
}

/**
 * Numbering follows the paper invoices: the issue date in DDMMYY form, with a
 * suffix when more than one invoice is raised on the same day. A collision can
 * still happen if two requests land in the same millisecond, so the loop walks
 * forward until it finds a free number rather than failing the request.
 */
async function allocateInvoiceNumber(deps: InvoiceDeps, issuedOn: Date): Promise<string> {
  const sameDay = await deps.invoices.countSameDay(issuedOn);
  for (let attempt = sameDay + 1; attempt <= sameDay + 50; attempt += 1) {
    const candidate = DocumentNumber.invoice(issuedOn, attempt);
    if (!(await deps.invoices.findByNumber(candidate))) return candidate;
  }
  throw new ConflictError('Could not allocate an invoice number, please try again');
}

export async function createInvoice(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  input: CreateInvoiceInput,
): Promise<InvoiceRecord> {
  requireRole(actor, 'staff');

  const settings = await deps.settings.get();
  const customerName = input.customerName.trim();
  if (!customerName) throw new ValidationError('An invoice needs a customer name');

  const currency = input.currency ?? (settings.defaultCurrency as CurrencyCode) ?? 'GHS';
  const issuedOn = input.issuedOn ?? deps.clock.now();
  const lines = normaliseLines(input.lines, () => deps.ids.next());

  const discountKind = input.discountKind ?? 'none';
  const discountValue = input.discountValue ?? 0;
  const vatRate = input.vatRate ?? settings.defaultVatRate ?? 0;

  const totals = calculateTotals({
    lines,
    currency,
    discountKind,
    discountValue,
    vatRate,
    amountPaidMinor: 0,
  });

  const invoiceNumber = await allocateInvoiceNumber(deps, issuedOn);

  const created = await deps.invoices.create({
    id: deps.ids.next(),
    invoiceNumber,
    customerReference: DocumentNumber.customerReference(customerName, invoiceNumber),
    clientId: input.clientId ?? null,
    jobId: input.jobId ?? null,
    customerName,
    customerAddress: input.customerAddress ?? null,
    customerPhone: input.customerPhone ?? null,
    customerEmail: input.customerEmail ?? null,
    currency,
    issuedOn,
    dueOn: input.dueOn ?? null,
    status: 'draft',
    discountKind,
    discountValue,
    vatRate,
    termsText: input.termsText ?? settings.defaultInvoiceTerms,
    paymentDetails: input.paymentDetails ?? settings.defaultPaymentDetails,
    notes: input.notes ?? null,
    subtotalMinor: totals.subtotal.minorUnits,
    discountMinor: totals.discount.minorUnits,
    vatMinor: totals.vat.minorUnits,
    totalMinor: totals.total.minorUnits,
    amountPaidMinor: 0,
    balanceMinor: totals.total.minorUnits,
    sentAt: null,
    voidedAt: null,
    createdBy: actor.userId,
    lines,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'create',
    entity: 'invoice',
    entityId: created.id,
    summary: `${actor.name} raised invoice ${invoiceNumber} for ${customerName} at ${totals.total.format()}`,
  });

  return created;
}

export type UpdateInvoiceInput = Partial<Omit<CreateInvoiceInput, 'lines'>> & {
  lines?: InvoiceLineInput[];
};

export async function updateInvoice(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  id: UUID,
  input: UpdateInvoiceInput,
): Promise<InvoiceRecord> {
  requireRole(actor, 'staff');

  const existing = await deps.invoices.findById(id);
  if (!existing) throw new NotFoundError('Invoice', id);
  assertEditable(existing);

  const lines = input.lines ? normaliseLines(input.lines, () => deps.ids.next()) : existing.lines;
  const currency = input.currency ?? existing.currency;
  const discountKind = input.discountKind ?? existing.discountKind;
  const discountValue = input.discountValue ?? existing.discountValue;
  const vatRate = input.vatRate ?? existing.vatRate;
  const dueOn = input.dueOn !== undefined ? input.dueOn : existing.dueOn;

  const totals = calculateTotals({
    lines,
    currency,
    discountKind,
    discountValue,
    vatRate,
    amountPaidMinor: existing.amountPaidMinor,
  });

  const customerName = input.customerName?.trim() ?? existing.customerName;

  const updated = await deps.invoices.update(
    id,
    {
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
      customerName,
      ...(input.customerAddress !== undefined ? { customerAddress: input.customerAddress } : {}),
      ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone } : {}),
      ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
      ...(input.issuedOn !== undefined ? { issuedOn: input.issuedOn } : {}),
      ...(input.termsText !== undefined ? { termsText: input.termsText } : {}),
      ...(input.paymentDetails !== undefined ? { paymentDetails: input.paymentDetails } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      currency,
      dueOn,
      discountKind,
      discountValue,
      vatRate,
      subtotalMinor: totals.subtotal.minorUnits,
      discountMinor: totals.discount.minorUnits,
      vatMinor: totals.vat.minorUnits,
      totalMinor: totals.total.minorUnits,
      balanceMinor: totals.balance.minorUnits,
      status: deriveStatus(existing.status, totals, dueOn, deps.clock.now()),
    },
    input.lines ? lines : undefined,
  );

  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'invoice',
    entityId: id,
    summary: `${actor.name} edited invoice ${existing.invoiceNumber}`,
  });

  return updated;
}

/** Moving a draft to sent is what starts the clock on the due date. */
export async function sendInvoice(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<InvoiceRecord> {
  requireRole(actor, 'staff');

  const existing = await deps.invoices.findById(id);
  if (!existing) throw new NotFoundError('Invoice', id);
  if (existing.status === 'void') throw new ValidationError('A void invoice cannot be sent');
  if (existing.status !== 'draft') return existing;

  const totals = calculateTotals({
    lines: existing.lines,
    currency: existing.currency,
    discountKind: existing.discountKind,
    discountValue: existing.discountValue,
    vatRate: existing.vatRate,
    amountPaidMinor: existing.amountPaidMinor,
  });

  const now = deps.clock.now();
  const updated = await deps.invoices.update(id, {
    status: deriveStatus('sent', totals, existing.dueOn, now),
    sentAt: now,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'send',
    entity: 'invoice',
    entityId: id,
    summary: `${actor.name} issued invoice ${existing.invoiceNumber}`,
  });

  return updated;
}

export async function voidInvoice(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  id: UUID,
  reason: string,
): Promise<InvoiceRecord> {
  requireRole(actor, 'admin');

  const existing = await deps.invoices.findById(id);
  if (!existing) throw new NotFoundError('Invoice', id);
  if (existing.amountPaidMinor > 0) {
    throw new ValidationError('An invoice with payments against it cannot be voided');
  }

  const updated = await deps.invoices.update(id, {
    status: 'void',
    voidedAt: deps.clock.now(),
    notes: reason.trim() ? `${existing.notes ?? ''}\nVoided: ${reason.trim()}`.trim() : existing.notes,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'void',
    entity: 'invoice',
    entityId: id,
    summary: `${actor.name} voided invoice ${existing.invoiceNumber}`,
    metadata: { reason },
  });

  return updated;
}

export async function deleteInvoice(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<void> {
  requireRole(actor, 'admin');
  const existing = await deps.invoices.findById(id);
  if (!existing) throw new NotFoundError('Invoice', id);
  if (existing.status !== 'draft') {
    throw new ValidationError('Only a draft invoice can be deleted, void it instead');
  }

  await deps.invoices.delete(id);
  await deps.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'invoice',
    entityId: id,
    summary: `${actor.name} deleted draft invoice ${existing.invoiceNumber}`,
  });
}

export interface RecordPaymentInput {
  invoiceId: UUID;
  amountMinor: number;
  method: PaymentMethod;
  reference?: string | null;
  paidOn?: Date;
  note?: string | null;
}

export interface RecordPaymentResult {
  payment: Payment;
  invoice: InvoiceRecord;
}

export async function recordPayment(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  requireRole(actor, 'staff');

  const invoice = await deps.invoices.findById(input.invoiceId);
  if (!invoice) throw new NotFoundError('Invoice', input.invoiceId);
  if (invoice.status === 'void') {
    throw new ValidationError('Payments cannot be recorded against a void invoice');
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new ValidationError('A payment must be greater than zero');
  }
  if (input.amountMinor > invoice.balanceMinor) {
    const balance = Money.fromMinor(invoice.balanceMinor, invoice.currency);
    throw new ValidationError(`That payment exceeds the outstanding balance of ${balance.format()}`);
  }

  const payment = await deps.payments.create({
    id: deps.ids.next(),
    invoiceId: invoice.id,
    jobId: invoice.jobId,
    clientId: invoice.clientId,
    amountMinor: input.amountMinor,
    currency: invoice.currency,
    method: input.method,
    reference: input.reference ?? null,
    paidOn: input.paidOn ?? deps.clock.now(),
    note: input.note ?? null,
    recordedBy: actor.userId,
  });

  // Re-sum from the ledger rather than adding to the cached column, so a
  // deleted or corrected payment can never leave the invoice out of step.
  const resummed = await deps.invoices.refreshPaymentTotals(invoice.id);
  const totals = calculateTotals({
    lines: resummed.lines,
    currency: resummed.currency,
    discountKind: resummed.discountKind,
    discountValue: resummed.discountValue,
    vatRate: resummed.vatRate,
    amountPaidMinor: resummed.amountPaidMinor,
  });

  const updated = await deps.invoices.update(invoice.id, {
    status: deriveStatus(
      resummed.status === 'draft' ? 'sent' : resummed.status,
      totals,
      resummed.dueOn,
      deps.clock.now(),
    ),
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'payment',
    entity: 'invoice',
    entityId: invoice.id,
    summary: `${actor.name} recorded ${Money.fromMinor(input.amountMinor, invoice.currency).format()} against invoice ${invoice.invoiceNumber}`,
    metadata: { method: input.method, reference: input.reference },
  });

  return { payment, invoice: updated };
}

export async function deletePayment(
  deps: InvoiceDeps,
  actor: SessionPrincipal,
  paymentId: UUID,
): Promise<InvoiceRecord | null> {
  requireRole(actor, 'admin');

  const payment = await deps.payments.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment', paymentId);

  await deps.payments.delete(paymentId);
  if (!payment.invoiceId) return null;

  const resummed = await deps.invoices.refreshPaymentTotals(payment.invoiceId);
  const totals = calculateTotals({
    lines: resummed.lines,
    currency: resummed.currency,
    discountKind: resummed.discountKind,
    discountValue: resummed.discountValue,
    vatRate: resummed.vatRate,
    amountPaidMinor: resummed.amountPaidMinor,
  });

  const updated = await deps.invoices.update(payment.invoiceId, {
    status: deriveStatus(
      resummed.status === 'paid' ? 'sent' : resummed.status,
      totals,
      resummed.dueOn,
      deps.clock.now(),
    ),
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'payment',
    entityId: paymentId,
    summary: `${actor.name} reversed a payment on invoice ${updated.invoiceNumber}`,
  });

  return updated;
}
