import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { repositories } from '@infra/deps';
import { formatDate, formatMoney, formatMoneyPlain } from '@/lib/utils';
import { Card, CardHeader, StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { InvoiceActions } from '@/components/admin/invoice-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const invoice = await repositories().invoices.findById((await params).id).catch(() => null);
  return { title: invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice' };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repos = repositories();

  const invoice = await repos.invoices.findById(id).catch(() => null);
  if (!invoice) notFound();

  const payments = await repos.payments.listForInvoice(id);

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.customerName}, issued ${formatDate(invoice.issuedOn, 'long')}`}
        action={<InvoiceActions invoice={invoice} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Line items"
              description={`${invoice.lines.length} lines`}
              action={<StatusBadge status={invoice.status} />}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left">
                    {['No.', 'Unit', 'Description', 'Qty', 'Unit price', 'Total'].map((heading, index) => (
                      <th
                        key={heading}
                        className={`px-4 py-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] ${
                          index >= 3 ? 'text-right' : ''
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {invoice.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">{index + 1}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                        {line.unitOfMeasure}
                      </td>
                      <td className="px-4 py-2.5">{line.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatMoneyPlain(line.unitPriceMinor)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatMoneyPlain(line.lineTotalMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payments"
              description={
                payments.length === 0
                  ? 'Nothing received yet'
                  : `${payments.length} received, ${formatMoney(invoice.amountPaidMinor, invoice.currency)} in total`
              }
            />
            {payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                Record a payment once the customer has paid.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatMoney(payment.amountMinor, payment.currency)}
                      </p>
                      <p className="text-xs capitalize text-[var(--text-muted)]">
                        {payment.method.replace(/_/g, ' ')}
                        {payment.reference ? `, ref ${payment.reference}` : ''}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                      {formatDate(payment.paidOn, 'long')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-[var(--text-secondary)]">
                {invoice.notes}
              </p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Totals" />
            <dl className="flex flex-col gap-2.5 p-5 text-sm">
              {[
                ['Sub-total', invoice.subtotalMinor],
                ...(invoice.discountMinor > 0
                  ? ([['Discount', -invoice.discountMinor]] as [string, number][])
                  : []),
                ...(invoice.vatMinor > 0
                  ? ([[`VAT (${invoice.vatRate}%)`, invoice.vatMinor]] as [string, number][])
                  : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">{label}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(value as number, invoice.currency)}
                  </dd>
                </div>
              ))}

              <div className="mt-1 flex items-center justify-between rounded-xl bg-gold-500/10 px-3 py-3">
                <dt className="font-bold">Total</dt>
                <dd className="font-display text-xl font-bold text-[var(--brand)]">
                  {formatMoney(invoice.totalMinor, invoice.currency)}
                </dd>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
                <dt className="text-[var(--text-secondary)]">Paid</dt>
                <dd className="font-medium tabular-nums text-[var(--color-success)]">
                  {formatMoney(invoice.amountPaidMinor, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-semibold">Balance due</dt>
                <dd
                  className={`font-bold tabular-nums ${
                    invoice.balanceMinor > 0
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-success)]'
                  }`}
                >
                  {formatMoney(invoice.balanceMinor, invoice.currency)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="flex flex-col gap-3 p-5 text-sm">
              {[
                ['Customer ID', invoice.customerReference],
                ['Issued', formatDate(invoice.issuedOn, 'long')],
                ['Due', invoice.dueOn ? formatDate(invoice.dueOn, 'long') : 'On receipt'],
                ['Phone', invoice.customerPhone ?? 'Not given'],
                ['Email', invoice.customerEmail ?? 'Not given'],
                ['Address', invoice.customerAddress ?? 'Not given'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {label}
                  </dt>
                  <dd className="mt-0.5 break-words text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
