import { Resend } from 'resend';
import type { EmailMessage, EmailResult } from '@core/entities';
import type { EmailSender } from '@app-layer/ports';
import { env } from '../config/env';

/**
 * The Resend adapter.
 *
 * Email is an optional capability: a fresh install has no API key and must
 * still work. Rather than throwing, the sender reports that it is not
 * configured and returns a `skipped` result, so every caller takes one path
 * and the admin sees a plain explanation instead of a stack trace.
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function describeMisconfiguration(): string | null {
  if (!env.email.apiKey) {
    return 'No RESEND_API_KEY is set, so nothing can be sent yet.';
  }
  if (!env.email.from) {
    return 'No sender address is set. Add one under Settings, Email.';
  }
  if (!EMAIL_SHAPE.test(env.email.from)) {
    return `The sender address "${env.email.from}" is not a valid email address.`;
  }
  return null;
}

let client: Resend | null = null;

function resend(): Resend {
  if (!client) client = new Resend(env.email.apiKey);
  return client;
}

export function createResendSender(overrides?: {
  from?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
}): EmailSender {
  const from = overrides?.from?.trim() || env.email.from;
  const fromName = overrides?.fromName?.trim() || env.email.fromName;

  const reason = (() => {
    if (!env.email.apiKey) return 'No RESEND_API_KEY is set, so nothing can be sent yet.';
    if (!from) return 'No sender address is configured. Add one under Settings, Email.';
    if (!EMAIL_SHAPE.test(from)) return `The sender address "${from}" is not valid.`;
    return null;
  })();

  const sender = fromName ? `${JSON.stringify(fromName.replace(/["\\]/g, ''))} <${from}>` : from;

  return {
    configured: reason === null,
    unavailableReason: reason,

    async send(message: EmailMessage): Promise<EmailResult> {
      if (reason) return { status: 'skipped', providerId: null, error: reason };

      const recipients = message.to.filter((address) => EMAIL_SHAPE.test(address));
      if (recipients.length === 0) {
        return { status: 'skipped', providerId: null, error: 'No valid recipient address' };
      }

      try {
        const result = await resend().emails.send({
          from: sender,
          to: recipients,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo || overrides?.replyTo || undefined,
          bcc: message.bcc?.length ? message.bcc : undefined,
          attachments: message.attachments?.map((attachment) => ({
            filename: attachment.filename,
            // Resend takes attachment bytes base64 encoded.
            content: attachment.content.toString('base64'),
            contentType: attachment.contentType,
          })),
        });

        if (result.error) {
          return { status: 'failed', providerId: null, error: result.error.message };
        }
        return { status: 'sent', providerId: result.data?.id ?? null };
      } catch (error) {
        // A provider outage must not take a request down with it.
        return {
          status: 'failed',
          providerId: null,
          error: error instanceof Error ? error.message : 'The email provider could not be reached',
        };
      }
    },
  };
}

/** Writes to the log instead of sending. Used when no provider is configured. */
export const loggingSender: EmailSender = {
  configured: false,
  unavailableReason: describeMisconfiguration() ?? 'Email is not configured.',

  async send(message) {
    console.info(`[email] not configured, would have sent "${message.subject}" to ${message.to.join(', ')}`);
    return {
      status: 'skipped',
      providerId: null,
      error: describeMisconfiguration() ?? 'Email is not configured.',
    };
  },
};
