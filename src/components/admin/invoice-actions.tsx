'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Ban, FileDown, FileText, Mail, Pencil, Send, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type InvoiceRecord, type PaymentMethod } from '@core/entities';
import { api } from '@/lib/api-client';
import { formatMoney, newIdempotencyKey, toDateInput } from '@/lib/utils';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/primitives';
import { SendEmailDialog } from '@/components/admin/send-email-dialog';

export function InvoiceActions({
  invoice,
  lastSentAt,
}: {
  invoice: InvoiceRecord;
  lastSentAt?: Date | string | null;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const send = useMutation({
    mutationFn: () => api.post(`/api/admin/invoices/${invoice.id}/send`, {}, { idempotent: false }),
    onSuccess: () => {
      toast.success('Invoice issued');
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editable = invoice.status !== 'void' && invoice.status !== 'paid';
  const payable = invoice.status !== 'void' && invoice.balanceMinor > 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={`/api/documents/invoices/${invoice.id}/pdf`}
          target="_blank"
          variant="outline"
          size="sm"
          leadingIcon={<FileText className="size-4" aria-hidden />}
        >
          PDF
        </ButtonLink>

        <ButtonLink
          href={`/api/documents/invoices/${invoice.id}/docx`}
          variant="outline"
          size="sm"
          leadingIcon={<FileDown className="size-4" aria-hidden />}
        >
          Word
        </ButtonLink>

        {invoice.status === 'draft' && (
          <Button
            size="sm"
            variant="secondary"
            loading={send.isPending}
            onClick={() => send.mutate()}
            leadingIcon={<Send className="size-4" aria-hidden />}
          >
            Issue
          </Button>
        )}

        {invoice.status !== 'void' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEmailing(true)}
            leadingIcon={<Mail className="size-4" aria-hidden />}
          >
            Email
          </Button>
        )}

        {editable && (
          <ButtonLink
            href={`/admin/invoices/${invoice.id}/edit`}
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil className="size-4" aria-hidden />}
          >
            Edit
          </ButtonLink>
        )}

        {payable && (
          <Button
            size="sm"
            variant="gold"
            onClick={() => setPaying(true)}
            leadingIcon={<Wallet className="size-4" aria-hidden />}
          >
            Record payment
          </Button>
        )}

        {invoice.status !== 'void' && invoice.amountPaidMinor === 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVoiding(true)}
            leadingIcon={<Ban className="size-4" aria-hidden />}
          >
            Void
          </Button>
        )}
      </div>

      {paying && <PaymentDialog invoice={invoice} onClose={() => setPaying(false)} />}
      {voiding && <VoidDialog invoice={invoice} onClose={() => setVoiding(false)} />}

      {emailing && (
        <SendEmailDialog
          endpoint={`/api/admin/invoices/${invoice.id}/email`}
          documentLabel="Invoice"
          reference={invoice.invoiceNumber}
          defaultTo={invoice.customerEmail}
          attachmentName={`Invoice-${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`}
          lastSentAt={lastSentAt}
          onClose={() => setEmailing(false)}
        />
      )}
    </>
  );
}

function PaymentDialog({ invoice, onClose }: { invoice: InvoiceRecord; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState((invoice.balanceMinor / 100).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('mobile_money');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(toDateInput(new Date()));
  const [note, setNote] = useState('');
  // One key per dialog, so a double click records one payment, not two.
  const [idempotencyKey] = useState(() => newIdempotencyKey('payment'));

  const record = useMutation({
    mutationFn: () =>
      api.post(
        `/api/admin/invoices/${invoice.id}/payments`,
        { amountMinor: amount, method, reference: reference || null, paidOn, note: note || null },
        { idempotencyKey },
      ),
    onSuccess: () => {
      toast.success('Payment recorded');
      router.refresh();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const value = Math.round(Number(amount.replace(/,/g, '')) * 100);
  const valid = value > 0 && value <= invoice.balanceMinor;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Record a payment"
      description={`Outstanding balance ${formatMoney(invoice.balanceMinor, invoice.currency)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={record.isPending}
            disabled={!valid}
            onClick={() => record.mutate()}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Input
          label={`Amount (${invoice.currency})`}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          error={
            value > invoice.balanceMinor
              ? `That is more than the outstanding ${formatMoney(invoice.balanceMinor, invoice.currency)}`
              : undefined
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((value) => ({
              value,
              label: PAYMENT_METHOD_LABELS[value],
            }))}
          />
          <Input
            label="Paid on"
            type="date"
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </div>

        <Input
          label="Reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          hint="Transaction ID, cheque number or similar"
        />

        <Textarea
          label="Note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Dialog>
  );
}

function VoidDialog({ invoice, onClose }: { invoice: InvoiceRecord; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState('');

  const voidIt = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/invoices/${invoice.id}/void`, { reason }, { idempotent: false }),
    onSuccess: () => {
      toast.success(`Invoice ${invoice.invoiceNumber} voided`);
      router.refresh();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Void invoice ${invoice.invoiceNumber}?`}
      description="A void invoice keeps its number and stays on the record, but can no longer be edited or paid."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={voidIt.isPending} onClick={() => voidIt.mutate()}>
            Void invoice
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Raised against the wrong customer."
      />
    </Dialog>
  );
}
