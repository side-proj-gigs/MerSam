import type { EmailSender } from '@app-layer/ports';
import { env } from '../config/env';
import { createGmailSender, gmailUnavailableReason } from './gmail';
import { createResendSender } from './resend';

/**
 * Picks the provider that will actually send.
 *
 * Two are supported and both talk HTTPS, so neither depends on SMTP being
 * reachable, which it is not from a serverless function on most hosts:
 *
 * - **Resend**, an API key and a verified sending domain. Better for
 *   transactional mail: proper deliverability reporting, and the address
 *   people see is the company's own.
 * - **Gmail**, OAuth 2.0 against an ordinary mailbox. Nothing to verify and
 *   nothing to pay for, but everything arrives from that Gmail address and
 *   Google applies its own daily sending limits.
 *
 * `EMAIL_PROVIDER` names one explicitly. Left at `auto`, whichever is
 * configured wins, and Resend is preferred when both are, because mail from
 * the company's own domain beats mail from somebody's Gmail.
 */
export function chooseEmailSender(): EmailSender {
  const wanted = env.email.provider;

  if (wanted === 'gmail') return createGmailSender();
  if (wanted === 'resend') return createResendSender();

  if (env.gmail.configured && !env.email.configured) return createGmailSender();
  if (env.email.configured) return createResendSender();

  // Neither is set up. Return the one that can explain itself most usefully:
  // if any Gmail variable has been started, assume that was the intention.
  const gmailStarted = Boolean(env.gmail.clientId || env.gmail.refreshToken || env.gmail.sender);
  return gmailStarted ? createGmailSender() : createResendSender();
}

/** Which provider is in play, for the settings page to report. */
export function activeEmailProvider(): 'resend' | 'gmail' {
  if (env.email.provider === 'gmail') return 'gmail';
  if (env.email.provider === 'resend') return 'resend';
  if (env.gmail.configured && !env.email.configured) return 'gmail';
  if (env.email.configured) return 'resend';
  return Boolean(env.gmail.clientId || env.gmail.refreshToken || env.gmail.sender)
    ? 'gmail'
    : 'resend';
}

export { gmailUnavailableReason };
