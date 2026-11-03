import { NotFoundError, RateLimitError, ValidationError } from '@core/errors';
import type {
  Client,
  Lead,
  LeadSource,
  LeadStatus,
  SessionPrincipal,
  Urgency,
  UUID,
} from '@core/entities';
import { EmailAddress, PhoneNumber } from '@core/value-objects/contact';
import type {
  AuditLogRepository,
  Clock,
  ClientRepository,
  IdGenerator,
  LeadRepository,
  Notifier,
  RateLimiter,
  ServiceRepository,
} from '../ports';
import { requireRole } from './auth';

export interface LeadDeps {
  leads: LeadRepository;
  clients: ClientRepository;
  services: ServiceRepository;
  audit: AuditLogRepository;
  notifier: Notifier;
  rateLimiter: RateLimiter;
  clock: Clock;
  ids: IdGenerator;
}

export interface SubmitEnquiryInput {
  fullName: string;
  email?: string | null;
  phone: string;
  location?: string;
  serviceId?: UUID | null;
  message: string;
  urgency?: Urgency;
  budgetHint?: string | null;
  source?: LeadSource;
  /** Client address, used to scope the submission rate limit. */
  fingerprint: string;
  /** Hidden field that only an automated submitter would fill in. */
  honeypot?: string;
}

const ENQUIRY_LIMIT = 5;
const ENQUIRY_WINDOW_SECONDS = 60 * 60;
const DEDUPE_WINDOW_MINUTES = 10;

export function buildLeadReference(year: number, sequence: number): string {
  return `ENQ-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * The public entry point. Three guards sit in front of the write: a honeypot
 * for naive bots, a per-client rate limit, and a content hash that collapses a
 * genuine double submission onto the first lead rather than creating a twin.
 */
export async function submitEnquiry(deps: LeadDeps, input: SubmitEnquiryInput): Promise<Lead> {
  if (input.honeypot && input.honeypot.trim() !== '') {
    // Answer as though it succeeded so the bot gains nothing from the signal.
    throw new ValidationError('Your enquiry could not be processed');
  }

  const fullName = input.fullName.trim();
  if (fullName.length < 2) throw new ValidationError('Please tell us your name');

  const message = input.message.trim();
  if (message.length < 10) {
    throw new ValidationError('Please describe what you need in a little more detail');
  }
  if (message.length > 4000) {
    throw new ValidationError('Please keep your message under 4000 characters');
  }

  const phone = PhoneNumber.create(input.phone);
  const email = input.email ? EmailAddress.create(input.email) : null;

  const verdict = await deps.rateLimiter.consume(
    `enquiry:${input.fingerprint}`,
    ENQUIRY_LIMIT,
    ENQUIRY_WINDOW_SECONDS,
  );
  if (!verdict.allowed) throw new RateLimitError(verdict.retryAfter);

  const duplicate = await deps.leads.findRecentDuplicate(
    phone.e164,
    message,
    DEDUPE_WINDOW_MINUTES,
  );
  if (duplicate) return duplicate;

  const service = input.serviceId ? await deps.services.findById(input.serviceId) : null;
  const now = deps.clock.now();
  const sequence = await deps.leads.nextSequence(now.getFullYear());

  const lead = await deps.leads.create({
    id: deps.ids.next(),
    reference: buildLeadReference(now.getFullYear(), sequence),
    fullName,
    email: email?.value ?? null,
    phone: phone.e164,
    location: input.location?.trim() ?? '',
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? null,
    message,
    urgency: input.urgency ?? 'flexible',
    budgetHint: input.budgetHint?.trim() || null,
    status: 'new',
    source: input.source ?? 'website',
    assignedTo: null,
    clientId: null,
    convertedAt: null,
    lastContactedAt: null,
    internalNotes: null,
  });

  // The notifier must not be able to fail the visitor's submission.
  void deps.notifier.notifyNewLead(lead).catch((error) => {
    console.error('Lead notification failed', error);
  });

  return lead;
}

export async function updateLeadStatus(
  deps: LeadDeps,
  actor: SessionPrincipal,
  id: UUID,
  status: LeadStatus,
  note?: string,
): Promise<Lead> {
  requireRole(actor, 'staff');

  const existing = await deps.leads.findById(id);
  if (!existing) throw new NotFoundError('Lead', id);

  const updated = await deps.leads.update(id, {
    status,
    lastContactedAt: status === 'contacted' ? deps.clock.now() : existing.lastContactedAt,
    internalNotes: note?.trim()
      ? `${existing.internalNotes ? `${existing.internalNotes}\n` : ''}${note.trim()}`
      : existing.internalNotes,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'lead',
    entityId: id,
    summary: `${actor.name} moved enquiry ${existing.reference} to ${status}`,
  });

  return updated;
}

export async function assignLead(
  deps: LeadDeps,
  actor: SessionPrincipal,
  id: UUID,
  assigneeId: UUID | null,
): Promise<Lead> {
  requireRole(actor, 'staff');
  const existing = await deps.leads.findById(id);
  if (!existing) throw new NotFoundError('Lead', id);

  const updated = await deps.leads.update(id, { assignedTo: assigneeId });
  await deps.audit.record({
    actorId: actor.userId,
    action: 'assign',
    entity: 'lead',
    entityId: id,
    summary: `${actor.name} reassigned enquiry ${existing.reference}`,
  });
  return updated;
}

export async function deleteLead(
  deps: LeadDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<void> {
  requireRole(actor, 'admin');
  const existing = await deps.leads.findById(id);
  if (!existing) throw new NotFoundError('Lead', id);
  await deps.leads.delete(id);
  await deps.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'lead',
    entityId: id,
    summary: `${actor.name} deleted enquiry ${existing.reference}`,
  });
}

export interface ConvertLeadResult {
  lead: Lead;
  client: Client;
}

/**
 * Turning an enquiry into a client is the handover from marketing to delivery.
 * An existing client on the same number is reused rather than duplicated.
 */
export async function convertLeadToClient(
  deps: LeadDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<ConvertLeadResult> {
  requireRole(actor, 'staff');

  const lead = await deps.leads.findById(id);
  if (!lead) throw new NotFoundError('Lead', id);
  if (lead.clientId) {
    const existing = await deps.clients.findById(lead.clientId);
    if (existing) return { lead, client: existing };
  }

  const matched = await deps.clients.findByPhone(lead.phone);
  const client =
    matched ??
    (await deps.clients.create({
      id: deps.ids.next(),
      reference: `CL-${String(await deps.clients.nextSequence()).padStart(4, '0')}`,
      name: lead.fullName,
      contactPerson: null,
      email: lead.email,
      phone: lead.phone,
      altPhone: null,
      address: lead.location,
      city: '',
      region: '',
      clientType: 'individual',
      notes: `Converted from enquiry ${lead.reference}`,
      isActive: true,
    }));

  const updatedLead = await deps.leads.update(id, {
    clientId: client.id,
    status: 'won',
    convertedAt: deps.clock.now(),
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'convert',
    entity: 'lead',
    entityId: id,
    summary: `${actor.name} converted enquiry ${lead.reference} into client ${client.reference}`,
  });

  return { lead: updatedLead, client };
}
