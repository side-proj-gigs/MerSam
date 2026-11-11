import type { EmailMessage, EmailResult } from '@core/entities';
import type { EmailSender } from '@app-layer/ports';
import { env } from '../config/env';
import { base64url, buildMimeMessage, encodeHeader } from './mime';

/**
 * Sending through a Gmail account.
 *
 * Two things are worth knowing before reading further.
 *
 * The first is that a Google API key, the `AIza...` kind, cannot send mail.
 * Google's own documentation describes an API key as the credential "used to
 * request access to public data", and a mailbox is not public data. The
 * `messages.send` endpoint wants an OAuth 2.0 access token, nothing else. So
 * this adapter takes a client id, a client secret and a refresh token, and
 * mints short-lived access tokens itself.
 *
 * The second is that none of this is SMTP. Everything here is ordinary HTTPS
 * to googleapis.com, which is exactly what a serverless function is allowed
 * to do. The same was already true of the Resend adapter beside it.
 *
 * `scripts/gmail-authorise.ts` walks through the one-time consent that
 * produces the refresh token.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/** Cached across invocations: a token lasts an hour, a cold start does not. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.gmail.clientId,
      client_secret: env.gmail.clientSecret,
      refresh_token: env.gmail.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
    // invalid_grant is the one worth naming: it means the refresh token has
    // been revoked or expired, and no amount of retrying will fix it.
    throw new Error(
      payload.error === 'invalid_grant'
        ? 'The Gmail refresh token is no longer valid. Run npm run gmail:authorise again.'
        : `Google refused the refresh token: ${reason}`,
    );
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/** Only used by tests, which need each case to start from a clean slate. */
export function resetGmailToken(): void {
  cachedToken = null;
}

export function gmailUnavailableReason(): string | null {
  if (!env.gmail.clientId || !env.gmail.clientSecret) {
    return 'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are not set.';
  }
  if (!env.gmail.refreshToken) {
    return 'No GMAIL_REFRESH_TOKEN is set. Run npm run gmail:authorise to obtain one.';
  }
  if (!env.gmail.sender) {
    return 'GMAIL_SENDER is not set. It must be the Gmail address that granted consent.';
  }
  return null;
}

export function createGmailSender(overrides?: { fromName?: string | null }): EmailSender {
  const reason = gmailUnavailableReason();
  const name = overrides?.fromName?.trim() || env.email.fromName;
  // Gmail rewrites the address to the authenticated account whatever we put
  // here, so only the display name is ours to choose.
  const from = name
    ? `${encodeHeader(name.replace(/["\\]/g, ''))} <${env.gmail.sender}>`
    : env.gmail.sender;

  return {
    configured: reason === null,
    unavailableReason: reason,

    async send(message: EmailMessage): Promise<EmailResult> {
      if (reason) return { status: 'skipped', providerId: null, error: reason };

      try {
        const token = await accessToken();
        const response = await fetch(SEND_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: base64url(buildMimeMessage(message, from)) }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          id?: string;
          error?: { message?: string; status?: string };
        };

        if (!response.ok) {
          return {
            status: 'failed',
            providerId: null,
            error: payload.error?.message ?? `Gmail refused the message (HTTP ${response.status})`,
          };
        }

        return { status: 'sent', providerId: payload.id ?? null };
      } catch (error) {
        // A provider outage must not take the request down with it.
        return {
          status: 'failed',
          providerId: null,
          error: error instanceof Error ? error.message : 'Gmail could not be reached',
        };
      }
    },
  };
}
