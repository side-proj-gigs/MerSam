import type { Timestamped, UUID } from './common';

export const EMAIL_KINDS = [
  'enquiry_confirmation',
  'lead_notification',
  'invoice',
  'work_report',
  'proposal',
  'test',
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  enquiry_confirmation: 'Enquiry confirmation',
  lead_notification: 'New enquiry alert',
  invoice: 'Invoice',
  work_report: 'Work report',
  proposal: 'Proposal',
  test: 'Test message',
};

/** `skipped` records a send that was never attempted, which is not a failure. */
export const EMAIL_STATUSES = ['sent', 'failed', 'skipped'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export interface EmailLogEntry extends Omit<Timestamped, 'updatedAt'> {
  id: UUID;
  kind: EmailKind;
  status: EmailStatus;
  recipient: string;
  subject: string;
  entityType: string | null;
  entityId: UUID | null;
  providerId: string | null;
  error: string | null;
  sentBy: UUID | null;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  status: EmailStatus;
  providerId: string | null;
  error?: string;
}

/** What the caller is told after asking for something to be sent. */
export interface EmailOutcome {
  status: EmailStatus;
  recipient: string;
  /** Present when nothing was sent, explaining why in words a person can act on. */
  reason?: string;
}
