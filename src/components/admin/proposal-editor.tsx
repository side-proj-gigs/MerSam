'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DISCOUNT_KINDS,
  calculateProposalTotals,
  normaliseProposalItems,
  type Client,
  type DiscountKind,
  type Page,
  type Proposal,
} from '@core/entities';
import { api, ApiError } from '@/lib/api-client';
import { formatMoneyPlain, newIdempotencyKey, parseMoneyToMinor, toDateInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Card, CardHeader } from '@/components/ui/primitives';

interface ItemDraft {
  key: string;
  section: string;
  title: string;
  description: string;
  unitOfMeasure: string;
  quantity: string;
  unitPrice: string;
  isOptional: boolean;
}

function blankItem(section = ''): ItemDraft {
  return {
    key: Math.random().toString(36).slice(2),
    section,
    title: '',
    description: '',
    unitOfMeasure: 'Item',
    quantity: '1',
    unitPrice: '',
    isOptional: false,
  };
}

const LETTER_SECTIONS = [
  { field: 'introduction', label: 'Opening', rows: 4, hint: 'The first thing they read after the greeting' },
  { field: 'scopeIntro', label: 'Scope introduction', rows: 4, hint: 'Sits above the priced table' },
  { field: 'closing', label: 'Closing', rows: 4, hint: 'Sits below the table, before the signatures' },
  { field: 'paymentTerms', label: 'Payment terms', rows: 3, hint: 'One term per line' },
  { field: 'termsText', label: 'Terms and conditions', rows: 5, hint: 'One term per line' },
] as const;

/**
 * Used for both creating and editing. The totals shown here come from the same
 * domain function the server uses, so the figure on screen is the figure that
 * gets stored, and optional items stay outside it exactly as they do on the PDF.
 */
export function ProposalEditor({ proposal }: { proposal?: Proposal }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = Boolean(proposal);

  const [form, setForm] = useState({
    clientId: proposal?.clientId ?? '',
    clientName: proposal?.clientName ?? '',
    clientCompany: proposal?.clientCompany ?? '',
    clientEmail: proposal?.clientEmail ?? '',
    clientPhone: proposal?.clientPhone ?? '',
    clientAddress: proposal?.clientAddress ?? '',
    title: proposal?.title ?? '',
    salutation: proposal?.salutation ?? '',
    introduction: proposal?.introduction ?? '',
    scopeIntro: proposal?.scopeIntro ?? '',
    closing: proposal?.closing ?? '',
    paymentTerms: proposal?.paymentTerms ?? '',
    termsText: proposal?.termsText ?? '',
    preparedBy: proposal?.preparedBy ?? '',
    preparedByRole: proposal?.preparedByRole ?? '',
    issuedOn: toDateInput(proposal?.issuedOn ?? new Date()),
    validUntil: toDateInput(proposal?.validUntil),
    notes: proposal?.notes ?? '',
  });

  const [discountKind, setDiscountKind] = useState<DiscountKind>(proposal?.discountKind ?? 'none');
  const [discountValue, setDiscountValue] = useState(
    proposal?.discountKind === 'fixed'
      ? formatMoneyPlain(proposal.discountValue)
      : String(proposal?.discountValue ?? 0),
  );
  const [vatRate, setVatRate] = useState(String(proposal?.vatRate ?? 0));

  const [items, setItems] = useState<ItemDraft[]>(() =>
    proposal && proposal.items.length > 0
      ? proposal.items.map((item) => ({
          key: item.id,
          section: item.section ?? '',
          title: item.title,
          description: item.description,
          unitOfMeasure: item.unitOfMeasure,
          quantity: String(item.quantity),
          unitPrice: formatMoneyPlain(item.unitPriceMinor),
          isOptional: item.isOptional,
        }))
      : [blankItem()],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey('proposal'));

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const clients = useQuery({
    queryKey: ['clients', 'picker'],
    queryFn: () => api.get<Page<Client>>('/api/admin/clients?pageSize=100'),
    staleTime: 120_000,
  });

  const totals = useMemo(() => {
    try {
      const prepared = normaliseProposalItems(
        items
          .filter((item) => item.title.trim())
          .map((item) => ({
            section: item.section || null,
            title: item.title,
            description: item.description,
            unitOfMeasure: item.unitOfMeasure,
            quantity: Number(item.quantity) || 0,
            unitPriceMinor: parseMoneyToMinor(item.unitPrice),
            isOptional: item.isOptional,
          })),
        () => Math.random().toString(36).slice(2),
      );

      return calculateProposalTotals({
        items: prepared,
        currency: proposal?.currency ?? 'GHS',
        discountKind,
        discountValue:
          discountKind === 'fixed' ? parseMoneyToMinor(discountValue) : Number(discountValue) || 0,
        vatRate: Number(vatRate) || 0,
      });
    } catch {
      // An incomplete line is normal while typing, so there is no total yet.
      return null;
    }
  }, [items, discountKind, discountValue, vatRate, proposal]);

  const payload = () => ({
    clientId: form.clientId || null,
    clientName: form.clientName,
    clientCompany: form.clientCompany || null,
    clientEmail: form.clientEmail || null,
    clientPhone: form.clientPhone || null,
    clientAddress: form.clientAddress || null,
    title: form.title,
    salutation: form.salutation || undefined,
    introduction: form.introduction || undefined,
    scopeIntro: form.scopeIntro || undefined,
    closing: form.closing || undefined,
    paymentTerms: form.paymentTerms || undefined,
    termsText: form.termsText || undefined,
    preparedBy: form.preparedBy || undefined,
    preparedByRole: form.preparedByRole || null,
    notes: form.notes || null,
    issuedOn: form.issuedOn,
    validUntil: form.validUntil || null,
    discountKind,
    // A fixed discount travels as minor units, a percentage as the number typed.
    discountValue:
      discountKind === 'fixed' ? parseMoneyToMinor(discountValue) : Number(discountValue) || 0,
    vatRate: Number(vatRate) || 0,
    items: items
      .filter((item) => item.title.trim())
      .map((item, index) => ({
        section: item.section || null,
        title: item.title,
        description: item.description,
        unitOfMeasure: item.unitOfMeasure || 'Item',
        quantity: Number(item.quantity) || 1,
        // Sent as typed; the schema turns the decimal into minor units.
        unitPriceMinor: item.unitPrice || '0',
        isOptional: item.isOptional,
        sortOrder: index + 1,
      })),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.patch<Proposal>(`/api/admin/proposals/${proposal!.id}`, payload())
        : api.post<Proposal>('/api/admin/proposals', payload(), { idempotencyKey }),
    onSuccess: (saved) => {
      toast.success(editing ? 'Proposal updated' : `Proposal ${saved.proposalNumber} drafted`);
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      router.push(`/admin/proposals/${saved.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setIdempotencyKey(newIdempotencyKey('proposal'));
      }
      toast.error(error.message);
    },
  });

  const valid = form.clientName.trim().length > 1 && form.title.trim().length > 2 && items.some((item) => item.title.trim());

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Card>
          <CardHeader title="Who it is for" description="Appears in the letterhead block" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Select
              label="Existing client"
              wrapperClassName="sm:col-span-2"
              value={form.clientId}
              placeholder="Not linked to a client"
              options={[
                { value: '', label: 'Not linked to a client' },
                ...(clients.data?.items ?? []).map((client) => ({
                  value: client.id,
                  label: `${client.name} (${client.reference})`,
                })),
              ]}
              onValueChange={(id) => {
                const client = clients.data?.items.find((item) => item.id === id);
                setForm((current) => ({
                  ...current,
                  clientId: id,
                  clientName: client?.name ?? current.clientName,
                  clientEmail: client?.email ?? current.clientEmail,
                  clientPhone: client?.phone ?? current.clientPhone,
                  clientAddress: client
                    ? [client.address, client.city].filter(Boolean).join(', ')
                    : current.clientAddress,
                }));
              }}
            />

            <Input
              label="Contact name"
              required
              value={form.clientName}
              onChange={(e) => set('clientName', e.target.value)}
              error={errors.clientName}
              placeholder="Mrs. Adwoa Asante"
            />
            <Input
              label="Company"
              value={form.clientCompany}
              onChange={(e) => set('clientCompany', e.target.value)}
              hint="Shown above the contact name when set"
            />
            <Input
              label="Email"
              type="email"
              value={form.clientEmail}
              onChange={(e) => set('clientEmail', e.target.value)}
              error={errors.clientEmail}
              hint="Where the proposal will be sent"
            />
            <Input
              label="Phone"
              value={form.clientPhone}
              onChange={(e) => set('clientPhone', e.target.value)}
            />
            <Input
              label="Address"
              wrapperClassName="sm:col-span-2"
              value={form.clientAddress}
              onChange={(e) => set('clientAddress', e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="The letter" description="Pre-written on creation, then yours to edit" />
          <div className="flex flex-col gap-4 p-5">
            <Input
              label="Title"
              aria-label="Proposal title"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              error={errors.title}
              placeholder="Borehole and treatment plant for Ridge Residences"
            />
            <Input
              label="Greeting"
              value={form.salutation}
              onChange={(e) => set('salutation', e.target.value)}
              hint="Derived from the contact name when left blank"
              placeholder="Dear Mrs. Asante"
            />

            {LETTER_SECTIONS.map((section) => (
              <Textarea
                key={section.field}
                label={section.label}
                rows={section.rows}
                hint={section.hint}
                value={form[section.field]}
                onChange={(e) => set(section.field, e.target.value)}
                placeholder={editing ? undefined : 'Leave blank and we will write the standard wording.'}
              />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Scope and pricing"
            description="Group lines by giving them the same section name"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    blankItem(current[current.length - 1]?.section ?? ''),
                  ])
                }
                leadingIcon={<Plus className="size-4" aria-hidden />}
              >
                Add line
              </Button>
            }
          />

          <div className="flex flex-col gap-4 p-5">
            {items.map((item, index) => (
              <div
                key={item.key}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <GripVertical className="size-3.5 opacity-40" aria-hidden />
                    Line {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.length === 1 ? [blankItem()] : current.filter((i) => i.key !== item.key),
                      )
                    }
                    className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--color-danger)]"
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Section"
                    aria-label={`Section for line ${index + 1}`}
                    value={item.section}
                    onChange={(e) => setItem(item.key, { section: e.target.value })}
                    placeholder="Phase 1, survey and drilling"
                  />
                  <Input
                    label="Title"
                    aria-label={`Title for line ${index + 1}`}
                    value={item.title}
                    onChange={(e) => setItem(item.key, { title: e.target.value })}
                    placeholder="Geophysical survey"
                  />
                </div>

                <Textarea
                  label="Description"
                  aria-label={`Description for line ${index + 1}`}
                  wrapperClassName="mt-3"
                  rows={2}
                  value={item.description}
                  onChange={(e) => setItem(item.key, { description: e.target.value })}
                  placeholder="What this line actually covers."
                />

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Input
                    label="Unit"
                    aria-label={`Unit for line ${index + 1}`}
                    value={item.unitOfMeasure}
                    onChange={(e) => setItem(item.key, { unitOfMeasure: e.target.value })}
                  />
                  <Input
                    label="Quantity"
                    aria-label={`Quantity for line ${index + 1}`}
                    value={item.quantity}
                    onChange={(e) => setItem(item.key, { quantity: e.target.value })}
                    inputMode="decimal"
                  />
                  <Input
                    label="Unit price"
                    aria-label={`Unit price for line ${index + 1}`}
                    value={item.unitPrice}
                    onChange={(e) => setItem(item.key, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                  <div className="flex flex-col justify-end">
                    <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      Line total
                    </p>
                    <p className="pb-2.5 text-right text-sm font-bold tabular-nums">
                      {formatMoneyPlain(
                        Math.round(parseMoneyToMinor(item.unitPrice) * (Number(item.quantity) || 0)),
                      )}
                    </p>
                  </div>
                </div>

                <Checkbox
                  label="Optional extra"
                  aria-label={`Line ${index + 1} is an optional extra`}
                  description="Priced separately and left out of the headline total"
                  className="mt-1"
                  checked={item.isOptional}
                  onChange={(e) => setItem(item.key, { isOptional: e.target.checked })}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <Card className="lg:sticky lg:top-20">
          <CardHeader title="Summary" />
          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Dated"
                type="date"
                value={form.issuedOn}
                onChange={(e) => set('issuedOn', e.target.value)}
              />
              <Input
                label="Valid until"
                type="date"
                value={form.validUntil}
                onChange={(e) => set('validUntil', e.target.value)}
                hint="30 days when blank"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Discount"
                value={discountKind}
                onValueChange={(value) => setDiscountKind(value as DiscountKind)}
                options={DISCOUNT_KINDS.map((value) => ({
                  value,
                  label: value === 'none' ? 'None' : value === 'fixed' ? 'Amount' : 'Percent',
                }))}
              />
              <Input
                label={discountKind === 'percentage' ? 'Percent' : 'Amount'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                disabled={discountKind === 'none'}
                inputMode="decimal"
              />
            </div>

            <Input
              label="VAT rate (%)"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              inputMode="decimal"
            />

            <dl className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-sm">
              {totals ? (
                <>
                  <Row label="Sub-total" value={totals.subtotal.format()} />
                  {!totals.discount.isZero() && (
                    <Row label="Discount" value={`-${totals.discount.format()}`} />
                  )}
                  {!totals.vat.isZero() && <Row label={`VAT (${vatRate}%)`} value={totals.vat.format()} />}
                  <div className="mt-1 flex items-center justify-between rounded-xl bg-gold-500/10 px-3 py-2.5">
                    <dt className="text-sm font-bold">Total</dt>
                    <dd className="font-display text-xl font-bold text-[var(--brand)]">
                      {totals.total.format()}
                    </dd>
                  </div>
                  {!totals.optional.isZero() && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Plus {totals.optional.format()} of optional extras, quoted separately.
                    </p>
                  )}
                </>
              ) : (
                <p className="py-3 text-center text-xs text-[var(--text-muted)]">
                  Add a title and a price to see the totals.
                </p>
              )}
            </dl>

            <Input
              label="Prepared by"
              value={form.preparedBy}
              onChange={(e) => set('preparedBy', e.target.value)}
              hint="Your name when left blank"
            />
            <Input
              label="Job title"
              value={form.preparedByRole}
              onChange={(e) => set('preparedByRole', e.target.value)}
              placeholder="Managing Director"
            />

            <Button
              variant="gold"
              size="lg"
              loading={save.isPending}
              disabled={!valid}
              onClick={() => save.mutate()}
            >
              {editing ? 'Save changes' : 'Create proposal'}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
