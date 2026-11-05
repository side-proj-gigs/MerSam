import { NotFoundError, ValidationError } from '@core/errors';
import type {
  EmailKind,
  EmailMessage,
  EmailOutcome,
  Lead,
  SessionPrincipal,
  SiteSettings,
  UUID,
} from '@core/entities';
import { EmailAddress } from '@core/value-objects/contact';
import type {
  AuditLogRepository,
  DocumentRenderer,
  EmailLogRepository,
  EmailSender,
  InvoiceRepository,
  ProposalRepository,
  SettingsRepository,
  WorkReportRepository,
} from '../ports';
import { requireRole } from './auth';

export interface EmailDeps {
  sender: EmailSender;
  log: EmailLogRepository;
  settings: SettingsRepository;
  documents: DocumentRenderer;
  invoices: InvoiceRepository;
  workReports: WorkReportRepository;
  proposals: ProposalRepository;
  audit: AuditLogRepository;
}

/** Everything a template needs to render, assembled once per send. */
export interface RenderedMessage {
  subject: string;
  html: string;
  text: string;
}

export type MessageBuilder = (settings: SiteSettings) => RenderedMessage;

interface DispatchInput {
  kind: EmailKind;
  to: string;
  build: MessageBuilder;
  entityType?: string;
  entityId?: UUID;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  sentBy?: UUID | null;
}

/**
 * The one place a message leaves the building.
 *
 * Every path runs through here so that four things are always true: the
 * address is validated, the company's own copy is blind copied in, the attempt
 * is written to the log whether it succeeded or not, and a provider failure is
 * reported as an outcome rather than thrown. Sending email is a side effect of
 * someone's real work; it must never be the reason that work fails.
 */
export async function dispatch(deps: EmailDeps, input: DispatchInput): Promise<EmailOutcome> {
  const settings = await deps.settings.get();

  const record = (status: 'sent' | 'failed' | 'skipped', subject: string, extra: { providerId?: string | null; error?: string | null }) =>
    deps.log.record({
      kind: input.kind,
      status,
      recipient: input.to,
      subject,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      providerId: extra.providerId ?? null,
      error: extra.error ?? null,
      sentBy: input.sentBy ?? null,
    });

  if (!settings.emailEnabled) {
    await record('skipped', `[${input.kind}]`, {
      error: 'Email sending is switched off in Settings',
    });
    return {
      status: 'skipped',
      recipient: input.to,
      reason: 'Email sending is switched off. Turn it on under Settings, Email.',
    };
  }

  if (!deps.sender.configured) {
    await record('skipped', `[${input.kind}]`, { error: deps.sender.unavailableReason });
    return {
      status: 'skipped',
      recipient: input.to,
      reason: deps.sender.unavailableReason ?? 'Email is not configured.',
    };
  }

  const address = EmailAddress.tryCreate(input.to);
  if (!address) {
    await record('skipped', `[${input.kind}]`, { error: `"${input.to}" is not a usable address` });
    return {
      status: 'skipped',
      recipient: input.to,
      reason: `"${input.to}" is not a usable email address.`,
    };
  }

  const rendered = input.build(settings);

  const message: EmailMessage = {
    to: [address.value],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: settings.emailReplyTo || settings.primaryEmail,
    bcc: settings.emailBcc ? [settings.emailBcc] : undefined,
    attachments: input.attachments,
  };

  const result = await deps.sender.send(message);
  await record(result.status, rendered.subject, {
    providerId: result.providerId,
    error: result.error,
  });

  return {
    status: result.status,
    recipient: address.value,
    reason: result.status === 'sent' ? undefined : result.error,
  };
}

/* ------------------------------------------------- enquiry confirmation */

/**
 * Sent to the person who filled in the contact form. Deliberately fire and
 * forget at the call site: a visitor's enquiry is saved regardless.
 */
export async function sendEnquiryConfirmation(
  deps: EmailDeps,
  lead: Lead,
  build: MessageBuilder,
): Promise<EmailOutcome> {
  const settings = await deps.settings.get();

  if (!settings.sendEnquiryConfirmation) {
    return { status: 'skipped', recipient: lead.email ?? '', reason: 'Confirmations are switched off' };
  }
  if (!lead.email) {
    return { status: 'skipped', recipient: '', reason: 'The enquiry did not include an email address' };
  }

  return dispatch(deps, {
    kind: 'enquiry_confirmation',
    to: lead.email,
    build,
    entityType: 'lead',
    entityId: lead.id,
  });
}

export async function sendLeadNotification(
  deps: EmailDeps,
  lead: Lead,
  build: MessageBuilder,
): Promise<EmailOutcome> {
  const settings = await deps.settings.get();
  const inbox = settings.emailBcc || settings.supportEmail || settings.primaryEmail;

  return dispatch(deps, {
    kind: 'lead_notification',
    to: inbox,
    build,
    entityType: 'lead',
    entityId: lead.id,
  });
}

/* -------------------------------------------------------- documents */

export interface SendDocumentInput {
  to?: string;
  note?: string;
}

export async function sendInvoiceEmail(
  deps: EmailDeps,
  actor: SessionPrincipal,
  invoiceId: UUID,
  input: SendDocumentInput,
  build: (settings: SiteSettings, note: string) => RenderedMessage,
): Promise<EmailOutcome> {
  requireRole(actor, 'staff');

  const invoice = await deps.invoices.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);

  const to = input.to?.trim() || invoice.customerEmail;
  if (!to) {
    throw new ValidationError(
      'This invoice has no customer email address. Add one, or type an address to send to.',
    );
  }

  const attachment = await deps.documents.invoicePdf(invoiceId);

  const outcome = await dispatch(deps, {
    kind: 'invoice',
    to,
    build: (settings) => build(settings, input.note?.trim() ?? ''),
    entityType: 'invoice',
    entityId: invoiceId,
    sentBy: actor.userId,
    attachments: [{ ...attachment, contentType: 'application/pdf' }],
  });

  if (outcome.status === 'sent') {
    await deps.audit.record({
      actorId: actor.userId,
      action: 'email',
      entity: 'invoice',
      entityId: invoiceId,
      summary: `${actor.name} emailed invoice ${invoice.invoiceNumber} to ${outcome.recipient}`,
    });
  }

  return outcome;
}

export async function sendWorkReportEmail(
  deps: EmailDeps,
  actor: SessionPrincipal,
  reportId: UUID,
  input: SendDocumentInput,
  build: (settings: SiteSettings, note: string) => RenderedMessage,
): Promise<EmailOutcome> {
  requireRole(actor, 'staff');

  const report = await deps.workReports.findById(reportId);
  if (!report) throw new NotFoundError('Work report', reportId);

  const to = input.to?.trim();
  if (!to) {
    throw new ValidationError('Type the address this report should be sent to.');
  }

  const attachment = await deps.documents.workReportPdf(reportId);

  const outcome = await dispatch(deps, {
    kind: 'work_report',
    to,
    build: (settings) => build(settings, input.note?.trim() ?? ''),
    entityType: 'work_report',
    entityId: reportId,
    sentBy: actor.userId,
    attachments: [{ ...attachment, contentType: 'application/pdf' }],
  });

  if (outcome.status === 'sent') {
    await deps.audit.record({
      actorId: actor.userId,
      action: 'email',
      entity: 'work_report',
      entityId: reportId,
      summary: `${actor.name} emailed report ${report.reportNumber} to ${outcome.recipient}`,
    });
  }

  return outcome;
}

export async function sendProposalEmail(
  deps: EmailDeps,
  actor: SessionPrincipal,
  proposalId: UUID,
  input: SendDocumentInput,
  build: (settings: SiteSettings, note: string) => RenderedMessage,
): Promise<EmailOutcome> {
  requireRole(actor, 'staff');

  const proposal = await deps.proposals.findById(proposalId);
  if (!proposal) throw new NotFoundError('Proposal', proposalId);

  const to = input.to?.trim() || proposal.clientEmail;
  if (!to) {
    throw new ValidationError(
      'This proposal has no client email address. Add one, or type an address to send to.',
    );
  }

  const attachment = await deps.documents.proposalPdf(proposalId);

  const outcome = await dispatch(deps, {
    kind: 'proposal',
    to,
    build: (settings) => build(settings, input.note?.trim() ?? ''),
    entityType: 'proposal',
    entityId: proposalId,
    sentBy: actor.userId,
    attachments: [{ ...attachment, contentType: 'application/pdf' }],
  });

  if (outcome.status === 'sent') {
    await deps.audit.record({
      actorId: actor.userId,
      action: 'email',
      entity: 'proposal',
      entityId: proposalId,
      summary: `${actor.name} emailed proposal ${proposal.proposalNumber} to ${outcome.recipient}`,
    });
  }

  return outcome;
}

/* -------------------------------------------------------------- status */

export interface EmailStatusReport {
  enabled: boolean;
  configured: boolean;
  reason: string | null;
  from: string | null;
}

export async function getEmailStatus(
  deps: EmailDeps,
  actor: SessionPrincipal,
): Promise<EmailStatusReport> {
  requireRole(actor, 'viewer');
  const settings = await deps.settings.get();

  return {
    enabled: settings.emailEnabled,
    configured: deps.sender.configured,
    reason: deps.sender.unavailableReason,
    from: settings.emailFromAddress,
  };
}

/** Proves the configuration end to end before anyone relies on it. */
export async function sendTestEmail(
  deps: EmailDeps,
  actor: SessionPrincipal,
  to: string,
  build: MessageBuilder,
): Promise<EmailOutcome> {
  requireRole(actor, 'admin');
  if (!to.trim()) throw new ValidationError('Type an address to send the test to');

  return dispatch(deps, {
    kind: 'test',
    to,
    build,
    sentBy: actor.userId,
  });
}
