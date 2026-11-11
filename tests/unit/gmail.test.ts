import { describe, expect, it } from 'vitest';
import { buildMimeMessage } from '../../src/infrastructure/email/mime';
import type { EmailMessage } from '../../src/core/entities';

/**
 * Gmail takes one opaque blob of RFC 5322, so a malformed message is not
 * rejected with a useful error: it arrives looking wrong, or arrives without
 * the invoice attached. These assert the parts that fail quietly.
 */

const base: EmailMessage = {
  to: ['client@example.com'],
  subject: 'Invoice 051126 from MerSam',
  html: '<p>Please find it attached.</p>',
  text: 'Please find it attached.',
};

const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');

/** Pulls the base64 payload that follows a given content type. */
function partAfter(mime: string, contentType: string): string {
  const lines = mime.split('\r\n');
  const index = lines.findIndex((line) => line.startsWith(`Content-Type: ${contentType}`));
  expect(index, `expected a ${contentType} part`).toBeGreaterThan(-1);
  const blank = lines.indexOf('', index);
  const end = lines.findIndex((line, i) => i > blank && line.startsWith('--'));
  return lines.slice(blank + 1, end).join('');
}

describe('building the message Gmail sends', () => {
  it('carries the envelope headers', () => {
    const mime = buildMimeMessage(
      { ...base, replyTo: 'hello@mersam.com', bcc: ['office@mersam.com'] },
      'MerSam <mersam@gmail.com>',
    );

    expect(mime).toContain('From: MerSam <mersam@gmail.com>');
    expect(mime).toContain('To: client@example.com');
    expect(mime).toContain('Bcc: office@mersam.com');
    expect(mime).toContain('Reply-To: hello@mersam.com');
    expect(mime).toContain('MIME-Version: 1.0');
  });

  it('leaves out headers that have no value, rather than sending them empty', () => {
    const mime = buildMimeMessage(base, 'mersam@gmail.com');
    expect(mime).not.toContain('Bcc:');
    expect(mime).not.toContain('Reply-To:');
  });

  it('sends both the plain text and the HTML, each recoverable', () => {
    const mime = buildMimeMessage(base, 'mersam@gmail.com');

    expect(mime).toContain('Content-Type: multipart/alternative');
    expect(decode(partAfter(mime, 'text/plain'))).toBe('Please find it attached.');
    expect(decode(partAfter(mime, 'text/html'))).toBe('<p>Please find it attached.</p>');
  });

  it('encodes a subject that is not plain ASCII', () => {
    // A cedi sign sent raw arrives mangled, and nothing reports it.
    const mime = buildMimeMessage({ ...base, subject: 'Proposal, GH₵76,700' }, 'a@b.com');
    const subject = mime.split('\r\n').find((line) => line.startsWith('Subject: '))!;

    expect(subject).toMatch(/^Subject: =\?UTF-8\?B\?/);
    expect(decode(subject.replace(/^Subject: =\?UTF-8\?B\?/, '').replace(/\?=$/, ''))).toBe(
      'Proposal, GH₵76,700',
    );
  });

  it('leaves an ASCII subject readable rather than encoding it needlessly', () => {
    const mime = buildMimeMessage(base, 'a@b.com');
    expect(mime).toContain('Subject: Invoice 051126 from MerSam');
  });

  it('attaches a PDF so the bytes survive the round trip', () => {
    const content = Buffer.from('%PDF-1.7\nthe actual invoice bytes\n');
    const mime = buildMimeMessage(
      {
        ...base,
        attachments: [
          { filename: 'Invoice-051126.pdf', content, contentType: 'application/pdf' },
        ],
      },
      'a@b.com',
    );

    expect(mime).toContain('Content-Type: multipart/mixed');
    expect(mime).toContain('Content-Disposition: attachment; filename="Invoice-051126.pdf"');

    const encoded = partAfter(mime, 'application/pdf');
    expect(Buffer.from(encoded, 'base64').equals(content)).toBe(true);
  });

  it('folds long base64 so the lines stay within the MIME limit', () => {
    const mime = buildMimeMessage(
      {
        ...base,
        attachments: [
          {
            filename: 'big.pdf',
            content: Buffer.alloc(8000, 0x41),
            contentType: 'application/pdf',
          },
        ],
      },
      'a@b.com',
    );

    const longest = Math.max(...mime.split('\r\n').map((line) => line.length));
    expect(longest).toBeLessThanOrEqual(998);
  });

  it('will not let a filename break out of its header', () => {
    const mime = buildMimeMessage(
      {
        ...base,
        attachments: [
          {
            filename: 'evil".pdf\r\nX-Injected: yes',
            content: Buffer.from('x'),
            contentType: 'application/pdf',
          },
        ],
      },
      'a@b.com',
    );

    // The text may survive inside the quoted filename, which is harmless.
    // What must not happen is a new header line, which is the actual attack.
    const lines = mime.split(/\r?\n/);
    expect(lines.some((line) => line.startsWith('X-Injected'))).toBe(false);
  });

  it('separates every part with its declared boundary', () => {
    const mime = buildMimeMessage(
      {
        ...base,
        attachments: [{ filename: 'a.pdf', content: Buffer.from('x'), contentType: 'application/pdf' }],
      },
      'a@b.com',
    );

    const mixed = mime.match(/boundary="(mixed_[a-z0-9]+)"/)![1]!;
    const alternative = mime.match(/boundary="(alt_[a-z0-9]+)"/)![1]!;

    // Each multipart has to be closed, or the tail is silently dropped.
    expect(mime).toContain(`--${alternative}--`);
    expect(mime.trimEnd().endsWith(`--${mixed}--`)).toBe(true);
  });
});
