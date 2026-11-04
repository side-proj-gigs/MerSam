'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DISCOUNT_KINDS,
  calculateTotals,
  normaliseLines,
  type Client,
  type DiscountKind,
  type InvoiceRecord,
  type Page,
} from '@core/entities';
import { api, ApiError } from '@/lib/api-client';
import { formatMoney, formatMoneyPlain, newIdempotencyKey, parseMoneyToMinor, toDateInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Card, CardHeader } from '@/components/ui/primitives';

interface LineDraft {
  key: string;
  unitOfMeasure: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function blankLine(): LineDraft {
  return {
    key: Math.random().toString(36).slice(2),
    unitOfMeasure: 'Pcs',
    description: '',
    quantity: '1',
    unitPrice: '',
  };
}

function toDrafts(invoice: InvoiceRecord | undefined): LineDraft[] {
  if (!invoice) return [blankLine()];
  return invoice.lines.map((line) => ({
    key: line.id,
    unitOfMeasure: line.unitOfMeasure,
    description: line.description,
    quantity: String(line.quantity),
    unitPrice: formatMoneyPlain(line.unitPriceMinor),
  }));
}

/**
 * Used for both creating and editing. The totals shown here are computed with
 * the same domain function the server uses, so the figure on screen is the
 * figure that will be stored rather than an approximation of it.
 */
export function InvoiceEditor({ invoice }: { invoice?: InvoiceRecord }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = Boolean(invoice);

  const [customerName, setCustomerName] = useState(invoice?.customerName ?? '');
  const [clientId, setClientId] = useState(invoice?.clientId ?? '');
  const [customerAddress, setCustomerAddress] = useState(invoice?.customerAddress ?? '');
  const [customerPhone, setCustomerPhone] = useState(invoice?.customerPhone ?? '');
  const [customerEmail, setCustomerEmail] = useState(invoice?.customerEmail ?? '');
  const [issuedOn, setIssuedOn] = useState(toDateInput(invoice?.issuedOn ?? new Date()));
  const [dueOn, setDueOn] = useState(toDateInput(invoice?.dueOn));
  const [discountKind, setDiscountKind] = useState<DiscountKind>(invoice?.discountKind ?? 'none');
  const [discountValue, setDiscountValue] = useState(
    invoice?.discountKind === 'fixed'
      ? formatMoneyPlain(invoice.discountValue)
      : String(invoice?.discountValue ?? 0),
  );
  const [vatRate, setVatRate] = useState(String(invoice?.vatRate ?? 0));
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() => toDrafts(invoice));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey('invoice'));

  const clients = useQuery({
    queryKey: ['clients', 'picker'],
    queryFn: () => api.get<Page<Client>>('/api/admin/clients?pageSize=100'),
    staleTime: 120_000,
  });

  /** Preview totals, recomputed as the person types. */
  const totals = useMemo(() => {
    try {
      const prepared = normaliseLines(
        lines
          .filter((line) => line.description.trim())
          .map((line) => ({
            unitOfMeasure: line.unitOfMeasure,
            description: line.description,
            quantity: Number(line.quantity) || 0,
            unitPriceMinor: parseMoneyToMinor(line.unitPrice),
          })),
        () => Math.random().toString(36).slice(2),
      );

      return calculateTotals({
        lines: prepared,
        currency: invoice?.currency ?? 'GHS',
        discountKind,
        discountValue:
          discountKind === 'fixed' ? parseMoneyToMinor(discountValue) : Number(discountValue) || 0,
        vatRate: Number(vatRate) || 0,
        amountPaidMinor: invoice?.amountPaidMinor ?? 0,
      });
    } catch {
      // An incomplete line is normal while typing, so no totals yet.
      return null;
    }
  }, [lines, discountKind, discountValue, vatRate, invoice]);

  const payload = () => ({
    clientId: clientId || null,
    customerName,
    customerAddress: customerAddress || null,
    customerPhone: customerPhone || null,
    customerEmail: customerEmail || null,
    issuedOn,
    dueOn: dueOn || null,
    discountKind,
    // A fixed discount travels as minor units, which is how the domain holds
    // it; a percentage travels as the plain number the person typed.
    discountValue:
      discountKind === 'fixed' ? parseMoneyToMinor(discountValue) : Number(discountValue) || 0,
    vatRate: Number(vatRate) || 0,
    notes: notes || null,
    lines: lines
      .filter((line) => line.description.trim())
      .map((line, index) => ({
        unitOfMeasure: line.unitOfMeasure || 'Pcs',
        description: line.description,
        quantity: Number(line.quantity) || 1,
        // Sent as typed; the schema converts the decimal into minor units.
        unitPriceMinor: line.unitPrice || '0',
        sortOrder: index + 1,
      })),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.patch<InvoiceRecord>(`/api/admin/invoices/${invoice!.id}`, payload())
        : api.post<InvoiceRecord>('/api/admin/invoices', payload(), { idempotencyKey }),
    onSuccess: (saved) => {
      toast.success(editing ? 'Invoice updated' : `Invoice ${saved.invoiceNumber} raised`);
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['invoice', saved.id] });
      router.push(`/admin/invoices/${saved.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        // A rejected attempt needs a fresh key or the corrected retry replays.
        setIdempotencyKey(newIdempotencyKey('invoice'));
      }
      toast.error(error.message);
    },
  });

  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const valid = customerName.trim().length > 1 && lines.some((line) => line.description.trim());

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Card>
          <CardHeader title="Customer" description="Who the invoice is addressed to" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Select
              label="Existing client"
              wrapperClassName="sm:col-span-2"
              value={clientId}
              onChange={(event) => {
                const id = event.target.value;
                setClientId(id);
                const client = clients.data?.items.find((item) => item.id === id);
                if (client) {
                  // Prefill from the client record, which is what the office expects.
                  setCustomerName(client.name);
                  setCustomerPhone(client.phone);
                  setCustomerEmail(client.email ?? '');
                  setCustomerAddress(
                    [client.address, client.city].filter(Boolean).join(', '),
                  );
                }
              }}
            >
              <option value="">Not linked to a client</option>
              {clients.data?.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.reference})
                </option>
              ))}
            </Select>

            <Input
              label="Customer name"
              required
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              error={errors.customerName}
            />
            <Input
              label="Phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              error={errors.customerEmail}
            />
            <Input
              label="Address"
              value={customerAddress}
              onChange={(event) => setCustomerAddress(event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Line items"
            description="Materials and workmanship, listed separately"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLines((current) => [...current, blankLine()])}
                leadingIcon={<Plus className="size-4" aria-hidden />}
              >
                Add line
              </Button>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  {['', 'Unit', 'Description', 'Qty', 'Unit price', 'Total', ''].map(
                    (heading, index) => (
                      <th
                        key={index}
                        className="px-2 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {lines.map((line, index) => {
                  const lineTotal = Math.round(
                    parseMoneyToMinor(line.unitPrice) * (Number(line.quantity) || 0),
                  );
                  return (
                    <tr key={line.key}>
                      <td className="px-2 py-2 text-center text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <GripVertical className="size-3.5 opacity-40" aria-hidden />
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={line.unitOfMeasure}
                          onChange={(event) =>
                            setLine(line.key, { unitOfMeasure: event.target.value })
                          }
                          className="w-16 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                          aria-label={`Unit for line ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={line.description}
                          onChange={(event) =>
                            setLine(line.key, { description: event.target.value })
                          }
                          placeholder='3/4" PPR Pipe'
                          className="w-full min-w-48 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                          aria-label={`Description for line ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={line.quantity}
                          onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                          inputMode="decimal"
                          className="w-20 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-right text-sm tabular-nums"
                          aria-label={`Quantity for line ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={line.unitPrice}
                          onChange={(event) => setLine(line.key, { unitPrice: event.target.value })}
                          inputMode="decimal"
                          placeholder="0.00"
                          className="w-28 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-right text-sm tabular-nums"
                          aria-label={`Unit price for line ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                        {formatMoneyPlain(lineTotal)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setLines((current) =>
                              current.length === 1
                                ? [blankLine()]
                                : current.filter((item) => item.key !== line.key),
                            )
                          }
                          className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--color-danger)]"
                          aria-label={`Remove line ${index + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Notes" description="Shown at the foot of the invoice" />
          <div className="p-5">
            <Textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the customer should know about this invoice."
            />
          </div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-20">
          <CardHeader title="Summary" />
          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Issued on"
                type="date"
                value={issuedOn}
                onChange={(event) => setIssuedOn(event.target.value)}
              />
              <Input
                label="Due on"
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Discount"
                value={discountKind}
                onChange={(event) => setDiscountKind(event.target.value as DiscountKind)}
                options={DISCOUNT_KINDS.map((value) => ({
                  value,
                  label: value === 'none' ? 'None' : value === 'fixed' ? 'Amount' : 'Percent',
                }))}
              />
              <Input
                label={discountKind === 'percentage' ? 'Percent' : 'Amount'}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                disabled={discountKind === 'none'}
                inputMode="decimal"
              />
            </div>

            <Input
              label="VAT rate (%)"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
              inputMode="decimal"
            />

            <dl className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-sm">
              {totals ? (
                <>
                  <Row label="Sub-total" value={totals.subtotal.format()} />
                  {!totals.discount.isZero() && (
                    <Row label="Discount" value={`-${totals.discount.format()}`} />
                  )}
                  {!totals.vat.isZero() && (
                    <Row label={`VAT (${vatRate}%)`} value={totals.vat.format()} />
                  )}
                  <div className="mt-1 flex items-center justify-between rounded-xl bg-gold-500/10 px-3 py-2.5">
                    <dt className="text-sm font-bold">Total</dt>
                    <dd className="font-display text-xl font-bold text-[var(--brand)]">
                      {totals.total.format()}
                    </dd>
                  </div>
                  {invoice && invoice.amountPaidMinor > 0 && (
                    <>
                      <Row label="Paid" value={formatMoney(invoice.amountPaidMinor)} />
                      <Row label="Balance" value={totals.balance.format()} strong />
                    </>
                  )}
                </>
              ) : (
                <p className="py-3 text-center text-xs text-[var(--text-muted)]">
                  Add a description and a price to see the totals.
                </p>
              )}
            </dl>

            <Button
              variant="gold"
              size="lg"
              loading={save.isPending}
              disabled={!valid}
              onClick={() => save.mutate()}
            >
              {editing ? 'Save changes' : 'Create invoice'}
            </Button>

            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'font-semibold' : 'text-[var(--text-secondary)]'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold' : 'font-medium'}`}>{value}</dd>
    </div>
  );
}
