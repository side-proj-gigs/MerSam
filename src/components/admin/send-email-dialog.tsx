'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Mail, Paperclip, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { EmailOutcome } from '@core/entities';
import { api } from '@/lib/api-client';
import { formatRelative, newIdempotencyKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/primitives';

export interface EmailStatus {
  enabled: boolean;
  configured: boolean;
  reason: string | null;
  from: string | null;
  confirmationsEnabled: boolean;
  bcc: string | null;
}

export function useEmailStatus() {
  return useQuery({
    queryKey: ['email-status'],
    queryFn: () => api.get<EmailStatus>('/api/admin/email/status'),
    staleTime: 60_000,
  });
}

/**
 * One dialog for every document the office emails.
 *
 * It states up front whether sending will work, because the alternative is
 * letting someone compose a note and press send only to be told afterwards
 * that no provider is configured.
 */
export function SendEmailDialog({
  endpoint,
  documentLabel,
  reference,
  defaultTo,
  attachmentName,
  lastSentAt,
  onClose,
  onSent,
}: {
  endpoint: string;
  documentLabel: string;
  reference: string;
  defaultTo: string | null;
  attachmentName: string;
  lastSentAt?: Date | string | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const router = useRouter();
  const status = useEmailStatus();
  const [to, setTo] = useState(defaultTo ?? '');
  const [note, setNote] = useState('');
  const [idempotencyKey] = useState(() => newIdempotencyKey('send'));

  const send = useMutation({
    mutationFn: () =>
      api.post<{ outcome: EmailOutcome }>(
        endpoint,
        { to: to.trim(), note: note.trim() },
        { idempotencyKey },
      ),
    onSuccess: (result) => {
      if (result.outcome.status === 'sent') {
        toast.success(`${documentLabel} sent to ${result.outcome.recipient}`);
        router.refresh();
        onSent?.();
        onClose();
        return;
      }

      // A skipped send is a configuration problem, not a crash: say so plainly.
      toast.error(result.outcome.reason ?? 'Nothing was sent', {
        description: 'Check Settings, Email.',
        duration: 8000,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const blocked = status.data && (!status.data.enabled || !status.data.configured);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to.trim());

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Email ${documentLabel.toLowerCase()} ${reference}`}
      description={`The PDF is attached automatically as ${attachmentName}.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={send.isPending}
            disabled={!valid || Boolean(blocked)}
            onClick={() => send.mutate()}
            leadingIcon={<Send className="size-4" aria-hidden />}
          >
            Send now
          </Button>
        </>
      }
    >
      {blocked && (
        <div className="mb-4 flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-[var(--text-primary)]">Email cannot send yet</p>
            <p className="mt-0.5 text-[var(--text-secondary)]">
              {!status.data?.enabled
                ? 'Sending is switched off. Turn it on under Settings, Email.'
                : (status.data?.reason ?? 'No provider is configured.')}
            </p>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              You can still download the {documentLabel.toLowerCase()} and send it yourself.
            </p>
          </div>
        </div>
      )}

      {lastSentAt && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          This was last sent {formatRelative(lastSentAt)}. Sending again replaces nothing, it simply
          delivers another copy.
        </p>
      )}

      <div className="grid gap-4">
        <Input
          label="Send to"
          required
          type="email"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          error={to.trim() && !valid ? 'That does not look like an email address' : undefined}
          hint={
            status.data?.from
              ? `Sent from ${status.data.from}${status.data.bcc ? `, copied to ${status.data.bcc}` : ''}`
              : undefined
          }
          placeholder="client@example.com"
        />

        <Textarea
          label="Message"
          rows={6}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          hint="Leave blank to use the standard wording for this document"
          placeholder={`Dear client,\n\nPlease find ${reference} attached.`}
        />

        <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Paperclip className="size-3.5 shrink-0" aria-hidden />
          {attachmentName}
        </p>
      </div>
    </Dialog>
  );
}
