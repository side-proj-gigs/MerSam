import type { EmailAttachment, EmailMessage } from '@core/entities';

/**
 * Turning a message into the one opaque blob of RFC 5322 that Gmail accepts.
 *
 * Kept apart from the transport because it is pure: no credentials, no
 * network, no configuration. That is also what makes it testable, and it
 * needs testing, because Gmail does not reject a malformed message with a
 * useful error. It arrives looking wrong, or arrives without the invoice.
 */

/** Gmail wants the raw message base64url encoded, not standard base64. */
export function base64url(value: Buffer | string): string {
  return (typeof value === 'string' ? Buffer.from(value, 'utf8') : value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Encodes a header value that is not plain ASCII.
 *
 * A subject like "Proposal for Mrs. Asante, GH₵76,700" is not ASCII, and an
 * unencoded cedi sign produces a mangled subject line in the recipient's
 * inbox rather than an error anybody would notice.
 */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Folds base64 to 76 characters, as the MIME specification requires. */
function wrap(value: string): string {
  return value.replace(/(.{76})/g, '$1\r\n');
}

function attachmentPart(attachment: EmailAttachment, boundary: string): string {
  // The filename is quoted and stripped of quotes of its own, so a document
  // called `Invoice "final".pdf` cannot break out of the header.
  const safeName = attachment.filename.replace(/["\\\r\n]/g, '');
  return [
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${safeName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeName}"`,
    '',
    wrap(attachment.content.toString('base64')),
    '',
  ].join('\r\n');
}

/**
 * Builds the RFC 5322 message.
 *
 * Nested on purpose: `multipart/mixed` holds the attachments, and inside it
 * `multipart/alternative` holds the plain text and the HTML, so a client that
 * refuses HTML still shows something readable and the PDF still arrives.
 */
export function buildMimeMessage(message: EmailMessage, from: string): string {
  const mixed = `mixed_${Math.random().toString(36).slice(2)}`;
  const alternative = `alt_${Math.random().toString(36).slice(2)}`;
  const attachments = message.attachments ?? [];

  const headers = [
    `From: ${from}`,
    `To: ${message.to.join(', ')}`,
    ...(message.bcc?.length ? [`Bcc: ${message.bcc.join(', ')}`] : []),
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
  ];

  const body = [
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    '',
    `--${alternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(message.text, 'utf8').toString('base64')),
    '',
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(message.html, 'utf8').toString('base64')),
    '',
    `--${alternative}--`,
    '',
    ...attachments.map((attachment) => attachmentPart(attachment, mixed)),
    `--${mixed}--`,
    '',
  ];

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    ...body,
  ].join('\r\n');
}
