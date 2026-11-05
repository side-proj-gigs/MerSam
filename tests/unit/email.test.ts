import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch, type EmailDeps } from '../../src/application/use-cases/email';
import type { EmailMessage, EmailResult, SiteSettings } from '../../src/core/entities';

/**
 * Email is a side effect of someone's real work: raising an invoice, answering
 * an enquiry. These tests pin down the promise the dispatcher makes, which is
 * that it reports what happened and never throws the caller's work away.
 */

type Recorded = Parameters<EmailDeps['log']['record']>[0];

function harness(
  overrides: {
    settings?: Partial<SiteSettings>;
    configured?: boolean;
    unavailableReason?: string | null;
    send?: (message: EmailMessage) => Promise<EmailResult>;
  } = {},
) {
  const recorded: Recorded[] = [];
  const sent: EmailMessage[] = [];

  const settings = {
    emailEnabled: true,
    emailBcc: 'office@mersam.test',
    emailReplyTo: null,
    primaryEmail: 'hello@mersam.test',
    ...overrides.settings,
  } as unknown as SiteSettings;

  const send =
    overrides.send ??
    (async (message: EmailMessage): Promise<EmailResult> => {
      sent.push(message);
      return { status: 'sent', providerId: 'provider-1' };
    });

  const deps = {
    sender: {
      configured: overrides.configured ?? true,
      unavailableReason: overrides.unavailableReason ?? null,
      send: async (message: EmailMessage) => {
        sent.push(message);
        return send(message);
      },
    },
    log: {
      record: async (entry: Recorded) => {
        recorded.push(entry);
      },
    },
    settings: { get: async () => settings },
  } as unknown as EmailDeps;

  return { deps, recorded, sent };
}

const build = () => ({ subject: 'Invoice INV/2026/004', html: '<p>hi</p>', text: 'hi' });

describe('email dispatch', () => {
  it('sends, reports the recipient and logs the attempt', async () => {
    const { deps, recorded, sent } = harness();

    const outcome = await dispatch(deps, { kind: 'invoice', to: 'client@example.com', build });

    expect(outcome.status).toBe('sent');
    expect(outcome.recipient).toBe('client@example.com');
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      kind: 'invoice',
      status: 'sent',
      subject: 'Invoice INV/2026/004',
      providerId: 'provider-1',
    });
    expect(sent[0]!.subject).toBe('Invoice INV/2026/004');
  });

  it('blind copies the office so there is always an internal record', async () => {
    const { deps, sent } = harness();
    await dispatch(deps, { kind: 'invoice', to: 'client@example.com', build });
    expect(sent[0]!.bcc).toEqual(['office@mersam.test']);
  });

  it('falls back to the public address when no reply-to is configured', async () => {
    const { deps, sent } = harness();
    await dispatch(deps, { kind: 'invoice', to: 'client@example.com', build });
    expect(sent[0]!.replyTo).toBe('hello@mersam.test');
  });

  it('skips with a reason when sending is switched off, without calling the provider', async () => {
    const send = vi.fn();
    const { deps, recorded } = harness({ settings: { emailEnabled: false }, send });

    const outcome = await dispatch(deps, { kind: 'invoice', to: 'client@example.com', build });

    expect(outcome.status).toBe('skipped');
    expect(outcome.reason).toMatch(/switched off/i);
    expect(send).not.toHaveBeenCalled();
    expect(recorded[0]!.status).toBe('skipped');
  });

  it('skips with the provider reason when no key is configured', async () => {
    const { deps } = harness({
      configured: false,
      unavailableReason: 'RESEND_API_KEY is not set',
    });

    const outcome = await dispatch(deps, { kind: 'proposal', to: 'client@example.com', build });

    expect(outcome.status).toBe('skipped');
    expect(outcome.reason).toBe('RESEND_API_KEY is not set');
  });

  it('skips a malformed address rather than handing it to the provider', async () => {
    const send = vi.fn();
    const { deps, recorded } = harness({ send });

    const outcome = await dispatch(deps, { kind: 'invoice', to: 'not an address', build });

    expect(outcome.status).toBe('skipped');
    expect(outcome.reason).toMatch(/not a usable/i);
    expect(send).not.toHaveBeenCalled();
    expect(recorded[0]!.error).toContain('not a usable address');
  });

  it('reports a provider failure as an outcome instead of throwing', async () => {
    const { deps, recorded } = harness({
      send: async () => ({ status: 'failed', providerId: null, error: 'Domain not verified' }),
    });

    const outcome = await dispatch(deps, { kind: 'work_report', to: 'client@example.com', build });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('Domain not verified');
    expect(recorded[0]).toMatchObject({ status: 'failed', error: 'Domain not verified' });
  });

  it('carries the document through as an attachment and ties the log to the record', async () => {
    const { deps, recorded, sent } = harness();

    await dispatch(deps, {
      kind: 'proposal',
      to: 'client@example.com',
      build,
      entityType: 'proposal',
      entityId: 'proposal-7',
      sentBy: 'user-1',
      attachments: [
        {
          filename: 'Proposal-PRO-2026-001.pdf',
          content: Buffer.from('%PDF-1.7'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(sent[0]!.attachments?.[0]!.filename).toBe('Proposal-PRO-2026-001.pdf');
    expect(recorded[0]).toMatchObject({
      entityType: 'proposal',
      entityId: 'proposal-7',
      sentBy: 'user-1',
    });
  });
});
