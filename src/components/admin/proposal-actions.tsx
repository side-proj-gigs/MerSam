'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileDown, FileText, Mail, Pencil, Send, ThumbsDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProposalStatus } from '@core/entities';
import { api } from '@/lib/api-client';
import { Button, ButtonLink } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/primitives';
import { SendEmailDialog } from '@/components/admin/send-email-dialog';

export interface ProposalActionsProps {
  proposal: {
    id: string;
    proposalNumber: string;
    status: ProposalStatus;
    clientEmail: string | null;
  };
  lastSentAt?: Date | string | null;
}

/**
 * Everything the office does with a proposal once it exists: take a copy away
 * as PDF or Word, send it, or write down what the client said.
 *
 * The downloads come first and never depend on email being configured, because
 * posting a printed letter by hand is still a perfectly normal way to deliver
 * one of these.
 */
export function ProposalActions({ proposal, lastSentAt }: ProposalActionsProps) {
  const router = useRouter();
  const [emailing, setEmailing] = useState(false);
  const [decision, setDecision] = useState<'accepted' | 'declined' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const markSent = useMutation({
    mutationFn: () => api.put(`/api/admin/proposals/${proposal.id}/decision`, {}),
    onSuccess: () => {
      toast.success(`${proposal.proposalNumber} marked as sent`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const open = proposal.status === 'draft' || proposal.status === 'sent' || proposal.status === 'expired';
  const filenameBase = proposal.proposalNumber.replace(/\//g, '-');

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={`/api/documents/proposals/${proposal.id}/pdf`}
          target="_blank"
          variant="outline"
          size="sm"
          leadingIcon={<FileText className="size-4" aria-hidden />}
        >
          PDF
        </ButtonLink>

        <ButtonLink
          href={`/api/documents/proposals/${proposal.id}/docx`}
          variant="outline"
          size="sm"
          leadingIcon={<FileDown className="size-4" aria-hidden />}
        >
          Word
        </ButtonLink>

        {open && (
          <Button
            size="sm"
            variant="gold"
            onClick={() => setEmailing(true)}
            leadingIcon={<Mail className="size-4" aria-hidden />}
          >
            Email to client
          </Button>
        )}

        {proposal.status === 'draft' && (
          <Button
            size="sm"
            variant="secondary"
            loading={markSent.isPending}
            onClick={() => markSent.mutate()}
            leadingIcon={<Send className="size-4" aria-hidden />}
          >
            Mark as sent
          </Button>
        )}

        {proposal.status !== 'accepted' && proposal.status !== 'declined' && (
          <ButtonLink
            href={`/admin/proposals/${proposal.id}/edit`}
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil className="size-4" aria-hidden />}
          >
            Edit
          </ButtonLink>
        )}

        {open && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDecision('accepted')}
              leadingIcon={<CheckCircle2 className="size-4" aria-hidden />}
            >
              Accepted
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDecision('declined')}
              leadingIcon={<ThumbsDown className="size-4" aria-hidden />}
            >
              Declined
            </Button>
          </>
        )}

        {proposal.status === 'draft' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleting(true)}
            leadingIcon={<Trash2 className="size-4" aria-hidden />}
            aria-label={`Delete proposal ${proposal.proposalNumber}`}
          >
            Delete
          </Button>
        )}
      </div>

      {emailing && (
        <SendEmailDialog
          endpoint={`/api/admin/proposals/${proposal.id}/send`}
          documentLabel="Proposal"
          reference={proposal.proposalNumber}
          defaultTo={proposal.clientEmail}
          attachmentName={`Proposal-${filenameBase}.pdf`}
          lastSentAt={lastSentAt}
          onClose={() => setEmailing(false)}
        />
      )}

      {decision && (
        <DecisionDialog
          proposalId={proposal.id}
          proposalNumber={proposal.proposalNumber}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}

      {deleting && (
        <DeleteDialog
          proposalId={proposal.id}
          proposalNumber={proposal.proposalNumber}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}

function DecisionDialog({
  proposalId,
  proposalNumber,
  decision,
  onClose,
}: {
  proposalId: string;
  proposalNumber: string;
  decision: 'accepted' | 'declined';
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const accepted = decision === 'accepted';

  const record = useMutation({
    mutationFn: () =>
      api.post(
        `/api/admin/proposals/${proposalId}/decision`,
        { decision, note: note.trim() || undefined },
        { idempotent: false },
      ),
    onSuccess: () => {
      toast.success(
        accepted
          ? `${proposalNumber} accepted. The enquiry behind it is now closed as won.`
          : `${proposalNumber} recorded as declined`,
      );
      router.refresh();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={accepted ? `Mark ${proposalNumber} as accepted?` : `Mark ${proposalNumber} as declined?`}
      description={
        accepted
          ? 'The proposal is locked from further edits and the enquiry it came from is marked won.'
          : 'The proposal is kept on the record so the pricing can be looked up later.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={accepted ? 'gold' : 'secondary'}
            loading={record.isPending}
            onClick={() => record.mutate()}
          >
            {accepted ? 'Record acceptance' : 'Record decline'}
          </Button>
        </>
      }
    >
      <Textarea
        label="Note"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        hint="Optional. What the client said, who confirmed it, anything worth remembering."
        placeholder={
          accepted
            ? 'Confirmed by phone on Monday, deposit promised this week.'
            : 'Went with another contractor on price.'
        }
      />
    </Dialog>
  );
}

function DeleteDialog({
  proposalId,
  proposalNumber,
  onClose,
}: {
  proposalId: string;
  proposalNumber: string;
  onClose: () => void;
}) {
  const router = useRouter();

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/proposals/${proposalId}`),
    onSuccess: () => {
      toast.success(`${proposalNumber} deleted`);
      router.replace('/admin/proposals');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Delete ${proposalNumber}?`}
      description="Only a draft can be deleted, and the number is not reused. This cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete proposal
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-secondary)]">
        If this proposal was already shown to the client, record it as declined instead so the
        pricing stays on file.
      </p>
    </Dialog>
  );
}
