import { ConflictError, NotFoundError, ValidationError } from '@core/errors';
import {
  calculateWorkReportTotals,
  normaliseCostLines,
  type SessionPrincipal,
  type UUID,
  type WorkReport,
  type WorkReportStatus,
} from '@core/entities';
import { DocumentNumber } from '@core/value-objects/identifiers';
import { Money, type CurrencyCode } from '@core/value-objects/money';
import type {
  AuditLogRepository,
  Clock,
  IdGenerator,
  InvoiceRepository,
  SettingsRepository,
  WorkReportRepository,
} from '../ports';
import { requireRole } from './auth';

export interface WorkReportDeps {
  workReports: WorkReportRepository;
  invoices: InvoiceRepository;
  settings: SettingsRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

export interface CostLineInput {
  id?: UUID;
  description: string;
  amountMinor: number;
  sortOrder?: number;
}

export interface CreateWorkReportInput {
  jobId?: UUID | null;
  clientId?: UUID | null;
  invoiceId?: UUID | null;
  clientName: string;
  serviceCategory: string;
  title?: string;
  dateOfWork: Date;
  reportDate?: Date;
  currency?: CurrencyCode;
  introduction?: string;
  workPerformed: string;
  completionNote?: string;
  paymentNote?: string;
  appreciation?: string;
  preparedBy?: string;
  authorisedRepresentative?: string | null;
  signatureImageUrl?: string | null;
  photoUrls?: string[];
  costLines: CostLineInput[];
  totalPaidMinor: number;
}

function formatLongDate(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The narrative sections follow the wording on the signed template. They are
 * written into the record at creation so the office can then edit any sentence
 * without the system rewriting it underneath them.
 */
export function defaultNarrative(input: {
  companyName: string;
  clientName: string;
  dateOfWork: Date;
  serviceCategory: string;
  totalPaid: Money;
  outstanding: Money;
}): Pick<
  WorkReport,
  'introduction' | 'completionNote' | 'paymentNote' | 'appreciation'
> {
  const { companyName, clientName, dateOfWork, serviceCategory } = input;
  const settled = input.outstanding.isZero();

  return {
    introduction: `${companyName} is pleased to present this report documenting the ${serviceCategory.toLowerCase()} work completed for ${clientName} on ${formatLongDate(dateOfWork)}, together with confirmation of the payment received.`,
    completionNote: `${companyName} confirms that the work described above was carried out to completion. This report serves as a record of the work performed, the total cost and the payment received.`,
    paymentNote: settled
      ? `${companyName} confirms that the client, ${clientName}, has paid the full amount of ${input.totalPaid.format()} for the work completed. The account has been settled in full, and there is no outstanding balance.`
      : `${companyName} confirms that the client, ${clientName}, has paid ${input.totalPaid.format()} towards the work completed. A balance of ${input.outstanding.format()} remains outstanding.`,
    appreciation: `${companyName} sincerely appreciates ${clientName} for choosing our services. We remain committed to providing reliable, professional and efficient service to our clients.\n\nThank you for choosing ${companyName}.`,
  };
}

async function allocateReportNumber(deps: WorkReportDeps, reportDate: Date): Promise<string> {
  const year = reportDate.getUTCFullYear();
  const sequence = await deps.workReports.nextSequence(year);
  for (let attempt = sequence; attempt <= sequence + 50; attempt += 1) {
    const candidate = DocumentNumber.workReport(year, attempt);
    if (!(await deps.workReports.findByNumber(candidate))) return candidate;
  }
  throw new ConflictError('Could not allocate a report number, please try again');
}

export async function createWorkReport(
  deps: WorkReportDeps,
  actor: SessionPrincipal,
  input: CreateWorkReportInput,
): Promise<WorkReport> {
  requireRole(actor, 'staff');

  const settings = await deps.settings.get();
  const clientName = input.clientName.trim();
  if (!clientName) throw new ValidationError('A report needs a client name');
  if (!input.workPerformed.trim()) {
    throw new ValidationError('A report needs a description of the work performed');
  }

  const currency = input.currency ?? (settings.defaultCurrency as CurrencyCode) ?? 'GHS';
  const reportDate = input.reportDate ?? deps.clock.now();
  const costLines = normaliseCostLines(input.costLines, () => deps.ids.next());
  const totals = calculateWorkReportTotals(costLines, input.totalPaidMinor, currency);

  const narrative = defaultNarrative({
    companyName: settings.companyName,
    clientName,
    dateOfWork: input.dateOfWork,
    serviceCategory: input.serviceCategory || 'service',
    totalPaid: totals.totalPaid,
    outstanding: totals.outstanding,
  });

  const reportNumber = await allocateReportNumber(deps, reportDate);

  const created = await deps.workReports.create({
    id: deps.ids.next(),
    reportNumber,
    jobId: input.jobId ?? null,
    clientId: input.clientId ?? null,
    invoiceId: input.invoiceId ?? null,
    clientName,
    serviceCategory: input.serviceCategory.trim(),
    title: input.title?.trim() || 'Work Completion and Payment Report',
    dateOfWork: input.dateOfWork,
    reportDate,
    currency,
    introduction: input.introduction?.trim() || narrative.introduction,
    workPerformed: input.workPerformed.trim(),
    completionNote: input.completionNote?.trim() || narrative.completionNote,
    paymentNote: input.paymentNote?.trim() || narrative.paymentNote,
    appreciation: input.appreciation?.trim() || narrative.appreciation,
    preparedBy: input.preparedBy?.trim() || settings.companyName,
    authorisedRepresentative: input.authorisedRepresentative ?? null,
    signatureImageUrl: input.signatureImageUrl ?? null,
    photoUrls: input.photoUrls ?? [],
    costLines,
    totalCostMinor: totals.totalCost.minorUnits,
    totalPaidMinor: totals.totalPaid.minorUnits,
    outstandingMinor: totals.outstanding.minorUnits,
    paymentState: totals.state,
    status: 'draft',
    createdBy: actor.userId,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'create',
    entity: 'work_report',
    entityId: created.id,
    summary: `${actor.name} drafted report ${reportNumber} for ${clientName}`,
  });

  return created;
}

export type UpdateWorkReportInput = Partial<Omit<CreateWorkReportInput, 'costLines'>> & {
  costLines?: CostLineInput[];
  status?: WorkReportStatus;
};

export async function updateWorkReport(
  deps: WorkReportDeps,
  actor: SessionPrincipal,
  id: UUID,
  input: UpdateWorkReportInput,
): Promise<WorkReport> {
  requireRole(actor, 'staff');

  const existing = await deps.workReports.findById(id);
  if (!existing) throw new NotFoundError('Work report', id);
  if (existing.status === 'archived') {
    throw new ValidationError('An archived report can no longer be edited');
  }

  const costLines = input.costLines
    ? normaliseCostLines(input.costLines, () => deps.ids.next())
    : existing.costLines;
  const currency = input.currency ?? existing.currency;
  const totalPaidMinor = input.totalPaidMinor ?? existing.totalPaidMinor;
  const totals = calculateWorkReportTotals(costLines, totalPaidMinor, currency);

  const text = <K extends keyof UpdateWorkReportInput>(key: K) =>
    input[key] !== undefined ? { [key]: String(input[key]).trim() } : {};

  const updated = await deps.workReports.update(
    id,
    {
      ...text('clientName'),
      ...text('serviceCategory'),
      ...text('title'),
      ...text('introduction'),
      ...text('workPerformed'),
      ...text('completionNote'),
      ...text('paymentNote'),
      ...text('appreciation'),
      ...text('preparedBy'),
      ...(input.authorisedRepresentative !== undefined
        ? { authorisedRepresentative: input.authorisedRepresentative }
        : {}),
      ...(input.signatureImageUrl !== undefined ? { signatureImageUrl: input.signatureImageUrl } : {}),
      ...(input.photoUrls !== undefined ? { photoUrls: input.photoUrls } : {}),
      ...(input.dateOfWork !== undefined ? { dateOfWork: input.dateOfWork } : {}),
      ...(input.reportDate !== undefined ? { reportDate: input.reportDate } : {}),
      ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.invoiceId !== undefined ? { invoiceId: input.invoiceId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      currency,
      totalCostMinor: totals.totalCost.minorUnits,
      totalPaidMinor: totals.totalPaid.minorUnits,
      outstandingMinor: totals.outstanding.minorUnits,
      paymentState: totals.state,
    },
    input.costLines ? costLines : undefined,
  );

  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'work_report',
    entityId: id,
    summary: `${actor.name} edited report ${existing.reportNumber}`,
  });

  return updated;
}

export async function issueWorkReport(
  deps: WorkReportDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<WorkReport> {
  requireRole(actor, 'staff');
  const existing = await deps.workReports.findById(id);
  if (!existing) throw new NotFoundError('Work report', id);

  const updated = await deps.workReports.update(id, { status: 'issued' });
  await deps.audit.record({
    actorId: actor.userId,
    action: 'issue',
    entity: 'work_report',
    entityId: id,
    summary: `${actor.name} issued report ${existing.reportNumber}`,
  });
  return updated;
}

export async function deleteWorkReport(
  deps: WorkReportDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<void> {
  requireRole(actor, 'admin');
  const existing = await deps.workReports.findById(id);
  if (!existing) throw new NotFoundError('Work report', id);

  await deps.workReports.delete(id);
  await deps.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'work_report',
    entityId: id,
    summary: `${actor.name} deleted report ${existing.reportNumber}`,
  });
}

/**
 * Builds a draft report straight from a settled or part-settled invoice, which
 * is the common path: the office raises the invoice, takes payment, then hands
 * the client a completion report carrying the same figures.
 */
export async function draftReportFromInvoice(
  deps: WorkReportDeps,
  actor: SessionPrincipal,
  invoiceId: UUID,
  overrides: { serviceCategory?: string; workPerformed?: string; dateOfWork?: Date } = {},
): Promise<WorkReport> {
  requireRole(actor, 'staff');

  const invoice = await deps.invoices.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);
  if (invoice.status === 'void') {
    throw new ValidationError('A report cannot be built from a void invoice');
  }

  return createWorkReport(deps, actor, {
    jobId: invoice.jobId,
    clientId: invoice.clientId,
    invoiceId: invoice.id,
    clientName: invoice.customerName,
    serviceCategory: overrides.serviceCategory ?? 'Plumbing and Sewage Maintenance',
    dateOfWork: overrides.dateOfWork ?? invoice.issuedOn,
    currency: invoice.currency,
    workPerformed:
      overrides.workPerformed ??
      `The following works were carried out and completed for ${invoice.customerName}:\n\n${invoice.lines
        .map((line) => `- ${line.description}`)
        .join('\n')}`,
    costLines: invoice.lines.map((line, index) => ({
      description: line.description,
      amountMinor: line.lineTotalMinor,
      sortOrder: index + 1,
    })),
    totalPaidMinor: invoice.amountPaidMinor,
  });
}
