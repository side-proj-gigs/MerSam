'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  calculateWorkReportTotals,
  normaliseCostLines,
  type Client,
  type Page,
  type WorkReport,
} from '@core/entities';
import type { InvoiceSummary } from '@app-layer/ports';
import { api, ApiError } from '@/lib/api-client';
import { formatMoneyPlain, newIdempotencyKey, parseMoneyToMinor, toDateInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Card, CardHeader } from '@/components/ui/primitives';

interface CostDraft {
  key: string;
  description: string;
  amount: string;
}

function blankCost(): CostDraft {
  return { key: Math.random().toString(36).slice(2), description: '', amount: '' };
}

const SECTIONS = [
  { field: 'introduction', label: '1. Introduction', rows: 3 },
  { field: 'workPerformed', label: '2. Description of work performed', rows: 5 },
  { field: 'paymentNote', label: '4. Payment confirmation', rows: 3 },
  { field: 'completionNote', label: '5. Work completion confirmation', rows: 3 },
  { field: 'appreciation', label: '6. Appreciation', rows: 3 },
] as const;

/**
 * Mirrors the numbered structure of the signed paper report. The narrative
 * sections are pre-written on creation and then left entirely to the office,
 * so the wording a client reads is the wording the office chose.
 */
export function ReportEditor({ report }: { report?: WorkReport }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = Boolean(report);

  const [form, setForm] = useState({
    clientId: report?.clientId ?? '',
    clientName: report?.clientName ?? '',
    serviceCategory: report?.serviceCategory ?? 'Plumbing and Sewage Maintenance',
    title: report?.title ?? 'Work Completion and Payment Report',
    dateOfWork: toDateInput(report?.dateOfWork ?? new Date()),
    reportDate: toDateInput(report?.reportDate ?? new Date()),
    introduction: report?.introduction ?? '',
    workPerformed: report?.workPerformed ?? '',
    paymentNote: report?.paymentNote ?? '',
    completionNote: report?.completionNote ?? '',
    appreciation: report?.appreciation ?? '',
    preparedBy: report?.preparedBy ?? 'MerSam',
    authorisedRepresentative: report?.authorisedRepresentative ?? '',
    totalPaid: report ? formatMoneyPlain(report.totalPaidMinor) : '',
  });

  const [costs, setCosts] = useState<CostDraft[]>(() =>
    report && report.costLines.length > 0
      ? report.costLines.map((line) => ({
          key: line.id,
          description: line.description,
          amount: formatMoneyPlain(line.amountMinor),
        }))
      : [blankCost()],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey('report'));

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const clients = useQuery({
    queryKey: ['clients', 'picker'],
    queryFn: () => api.get<Page<Client>>('/api/admin/clients?pageSize=100'),
    staleTime: 120_000,
  });

  const invoices = useQuery({
    queryKey: ['invoices', 'picker'],
    queryFn: () => api.get<Page<InvoiceSummary>>('/api/admin/invoices?pageSize=50'),
    staleTime: 120_000,
    enabled: !editing,
  });

  const totals = useMemo(() => {
    try {
      const prepared = normaliseCostLines(
        costs
          .filter((cost) => cost.description.trim())
          .map((cost) => ({ description: cost.description, amountMinor: parseMoneyToMinor(cost.amount) })),
        () => Math.random().toString(36).slice(2),
      );
      return calculateWorkReportTotals(prepared, parseMoneyToMinor(form.totalPaid), 'GHS');
    } catch {
      return null;
    }
  }, [costs, form.totalPaid]);

  const payload = () => ({
    clientId: form.clientId || null,
    clientName: form.clientName,
    serviceCategory: form.serviceCategory,
    title: form.title,
    dateOfWork: form.dateOfWork,
    reportDate: form.reportDate,
    introduction: form.introduction || undefined,
    workPerformed: form.workPerformed,
    paymentNote: form.paymentNote || undefined,
    completionNote: form.completionNote || undefined,
    appreciation: form.appreciation || undefined,
    preparedBy: form.preparedBy || undefined,
    authorisedRepresentative: form.authorisedRepresentative || null,
    totalPaidMinor: form.totalPaid || '0',
    costLines: costs
      .filter((cost) => cost.description.trim())
      .map((cost, index) => ({
        description: cost.description,
        amountMinor: cost.amount || '0',
        sortOrder: index + 1,
      })),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.patch<WorkReport>(`/api/admin/work-reports/${report!.id}`, payload())
        : api.post<WorkReport>('/api/admin/work-reports', payload(), { idempotencyKey }),
    onSuccess: (saved) => {
      toast.success(editing ? 'Report updated' : `Report ${saved.reportNumber} drafted`);
      void queryClient.invalidateQueries({ queryKey: ['work-reports'] });
      router.push(`/admin/reports/${saved.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setIdempotencyKey(newIdempotencyKey('report'));
      }
      toast.error(error.message);
    },
  });

  const fromInvoice = useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<WorkReport>('/api/admin/work-reports/from-invoice', { invoiceId }),
    onSuccess: (saved) => {
      toast.success(`Report ${saved.reportNumber} built from the invoice`);
      void queryClient.invalidateQueries({ queryKey: ['work-reports'] });
      router.push(`/admin/reports/${saved.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid = form.clientName.trim().length > 1 && form.workPerformed.trim().length > 10;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        {!editing && (
          <Card>
            <CardHeader
              title="Start from an invoice"
              description="Carries the customer, the lines and the payment across"
            />
            <div className="flex flex-col gap-3 p-5 sm:flex-row">
              <Select
                wrapperClassName="flex-1"
                aria-label="Invoice"
                value=""
                placeholder={invoices.isPending ? 'Loading invoices' : 'Choose an invoice'}
                disabled={fromInvoice.isPending}
                options={(invoices.data?.items ?? []).map((invoice) => ({
                  value: invoice.id,
                  label: `${invoice.invoiceNumber} | ${invoice.customerName}`,
                }))}
                onValueChange={(invoiceId) => {
                  if (invoiceId) fromInvoice.mutate(invoiceId);
                }}
              />
              <span className="flex items-center gap-2 self-center text-xs text-[var(--text-muted)]">
                <Wand2 className="size-4" aria-hidden />
                Or fill the form below
              </span>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Report header" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Select
              label="Client"
              wrapperClassName="sm:col-span-2"
              value={form.clientId}
              onChange={(event) => {
                const id = event.target.value;
                const client = clients.data?.items.find((item) => item.id === id);
                setForm((current) => ({
                  ...current,
                  clientId: id,
                  clientName: client?.name ?? current.clientName,
                }));
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
              label="Client name"
              required
              value={form.clientName}
              onChange={(event) => set('clientName', event.target.value)}
              error={errors.clientName}
            />
            <Input
              label="Service category"
              required
              value={form.serviceCategory}
              onChange={(event) => set('serviceCategory', event.target.value)}
              error={errors.serviceCategory}
            />
            <Input
              label="Date of work"
              type="date"
              value={form.dateOfWork}
              onChange={(event) => set('dateOfWork', event.target.value)}
            />
            <Input
              label="Report date"
              type="date"
              value={form.reportDate}
              onChange={(event) => set('reportDate', event.target.value)}
            />
            <Input
              label="Title"
              wrapperClassName="sm:col-span-2"
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="3. Cost and payment breakdown"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCosts((current) => [...current, blankCost()])}
                leadingIcon={<Plus className="size-4" aria-hidden />}
              >
                Add line
              </Button>
            }
          />
          <div className="flex flex-col gap-2.5 p-5">
            {costs.map((cost, index) => (
              <div key={cost.key} className="flex gap-2">
                <input
                  value={cost.description}
                  onChange={(event) =>
                    setCosts((current) =>
                      current.map((item) =>
                        item.key === cost.key ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Labour cost for sewage pipe unblocking"
                  aria-label={`Cost description ${index + 1}`}
                  className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm"
                />
                <input
                  value={cost.amount}
                  onChange={(event) =>
                    setCosts((current) =>
                      current.map((item) =>
                        item.key === cost.key ? { ...item, amount: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="0.00"
                  inputMode="decimal"
                  aria-label={`Cost amount ${index + 1}`}
                  className="w-32 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-right text-sm tabular-nums"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCosts((current) =>
                      current.length === 1 ? [blankCost()] : current.filter((item) => item.key !== cost.key),
                    )
                  }
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--color-danger)]"
                  aria-label={`Remove cost line ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Narrative sections"
            description="Pre-written on creation, then entirely yours to edit"
          />
          <div className="flex flex-col gap-4 p-5">
            {SECTIONS.map((section) => (
              <Textarea
                key={section.field}
                label={section.label}
                rows={section.rows}
                value={form[section.field]}
                onChange={(event) => set(section.field, event.target.value)}
                error={errors[section.field]}
                placeholder={
                  editing ? undefined : 'Leave blank and we will write the standard wording for you.'
                }
              />
            ))}
          </div>
        </Card>
      </div>

      <div>
        <Card className="lg:sticky lg:top-20">
          <CardHeader title="Totals and signature" />
          <div className="flex flex-col gap-4 p-5">
            <Input
              label="Total amount paid"
              value={form.totalPaid}
              onChange={(event) => set('totalPaid', event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />

            <dl className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-sm">
              {totals ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Total cost of work</dt>
                    <dd className="font-semibold tabular-nums">{totals.totalCost.format()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Total amount paid</dt>
                    <dd className="font-medium tabular-nums">{totals.totalPaid.format()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-semibold">Outstanding balance</dt>
                    <dd
                      className={`font-bold tabular-nums ${
                        totals.outstanding.isZero()
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-warning)]'
                      }`}
                    >
                      {totals.outstanding.format()}
                    </dd>
                  </div>
                  <p
                    className={`mt-1 rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.08em] ${
                      totals.state === 'fully_paid'
                        ? 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]'
                        : 'bg-gold-500/12 text-[var(--brand)]'
                    }`}
                  >
                    {totals.state.replace(/_/g, ' ')}
                  </p>
                </>
              ) : (
                <p className="py-3 text-center text-xs text-[var(--text-muted)]">
                  Add a cost line to see the totals.
                </p>
              )}
            </dl>

            <Input
              label="Prepared by"
              value={form.preparedBy}
              onChange={(event) => set('preparedBy', event.target.value)}
            />
            <Input
              label="Authorised representative"
              value={form.authorisedRepresentative}
              onChange={(event) => set('authorisedRepresentative', event.target.value)}
              hint="Leave blank for a hand-signed line"
            />

            <Button
              variant="gold"
              size="lg"
              loading={save.isPending}
              disabled={!valid}
              onClick={() => save.mutate()}
            >
              {editing ? 'Save changes' : 'Create report'}
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
