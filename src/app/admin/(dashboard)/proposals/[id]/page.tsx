import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { calculateProposalTotals } from '@core/entities';
import { repositories } from '@infra/deps';
import { formatDate, formatMoney, formatMoneyPlain, paragraphs } from '@/lib/utils';
import { Badge, Card, CardHeader, StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { ProposalActions } from '@/components/admin/proposal-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const proposal = await repositories().proposals.findById((await params).id).catch(() => null);
  return { title: proposal ? `Proposal ${proposal.proposalNumber}` : 'Proposal' };
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repos = repositories();

  const proposal = await repos.proposals.findById(id).catch(() => null);
  if (!proposal) notFound();

  const lastEmail = await repos.emailLog.lastSuccessFor('proposal', id);

  const totals = calculateProposalTotals({
    items: proposal.items,
    currency: proposal.currency,
    discountKind: proposal.discountKind,
    discountValue: proposal.discountValue,
    vatRate: proposal.vatRate,
  });

  const included = proposal.items.filter((item) => !item.isOptional);
  const optional = proposal.items.filter((item) => item.isOptional);

  return (
    <>
      <PageHeader
        title={proposal.title}
        description={`${proposal.proposalNumber} for ${proposal.clientCompany ?? proposal.clientName}, dated ${formatDate(proposal.issuedOn, 'long')}`}
        action={
          <ProposalActions
            proposal={{
              id: proposal.id,
              proposalNumber: proposal.proposalNumber,
              status: proposal.status,
              clientEmail: proposal.clientEmail,
            }}
            lastSentAt={lastEmail?.createdAt ?? null}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader title="The letter" action={<StatusBadge status={proposal.status} />} />
            <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">{proposal.salutation},</p>
              {paragraphs(proposal.introduction).map((block, index) => (
                <p key={index}>{block}</p>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Scope and pricing" description={`${included.length} lines`} />
            {proposal.scopeIntro && (
              <div className="border-b border-[var(--border-subtle)] px-5 py-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(proposal.scopeIntro).map((block, index) => (
                  <p key={index} className="mb-2 last:mb-0">
                    {block}
                  </p>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left">
                    {['Item', 'Qty', 'Unit price', 'Amount'].map((heading, index) => (
                      <th
                        key={heading}
                        className={`px-4 py-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] ${index > 0 ? 'text-right' : ''}`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {included.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        {item.section && (
                          <p className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--brand)]">
                            {item.section}
                          </p>
                        )}
                        <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoneyPlain(item.unitPriceMinor)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoneyPlain(item.lineTotalMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {optional.length > 0 && (
            <Card>
              <CardHeader
                title="Optional extras"
                description="Priced separately and left out of the total"
              />
              <ul className="divide-y divide-[var(--border-subtle)]">
                {optional.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.description}</p>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-semibold tabular-nums">
                      {formatMoneyPlain(item.lineTotalMinor)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Terms" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">
                  Payment terms
                </p>
                {proposal.paymentTerms.split('\n').filter(Boolean).map((line, index) => (
                  <p key={index} className="mb-1 text-sm text-[var(--text-secondary)]">
                    {line}
                  </p>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">
                  Terms and conditions
                </p>
                {proposal.termsText.split('\n').filter(Boolean).map((line, index) => (
                  <p key={index} className="mb-1 text-sm text-[var(--text-secondary)]">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </Card>

          {proposal.closing && (
            <Card>
              <CardHeader title="Closing" />
              <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(proposal.closing).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Totals" />
            <dl className="flex flex-col gap-2.5 p-5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--text-secondary)]">Sub-total</dt>
                <dd className="font-medium tabular-nums">{totals.subtotal.format()}</dd>
              </div>
              {!totals.discount.isZero() && (
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Discount</dt>
                  <dd className="font-medium tabular-nums">-{totals.discount.format()}</dd>
                </div>
              )}
              {!totals.vat.isZero() && (
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">VAT ({proposal.vatRate}%)</dt>
                  <dd className="font-medium tabular-nums">{totals.vat.format()}</dd>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between rounded-xl bg-gold-500/10 px-3 py-3">
                <dt className="font-bold">Total</dt>
                <dd className="font-display text-xl font-bold text-[var(--brand)]">
                  {formatMoney(proposal.totalMinor, proposal.currency)}
                </dd>
              </div>
              {!totals.optional.isZero() && (
                <p className="text-xs text-[var(--text-muted)]">
                  Plus {totals.optional.format()} of optional extras.
                </p>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="flex flex-col gap-3 p-5 text-sm">
              {[
                ['Client', proposal.clientCompany ?? proposal.clientName],
                ['Contact', proposal.clientName],
                ['Email', proposal.clientEmail ?? 'Not given'],
                ['Phone', proposal.clientPhone ?? 'Not given'],
                ['Valid until', proposal.validUntil ? formatDate(proposal.validUntil, 'long') : 'On request'],
                ['Prepared by', proposal.preparedByRole ? `${proposal.preparedBy}, ${proposal.preparedByRole}` : proposal.preparedBy],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {label}
                  </dt>
                  <dd className="mt-0.5 break-words text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
              {lastEmail && (
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Last emailed
                  </dt>
                  <dd className="mt-0.5">
                    <Badge tone="success">
                      {formatDate(lastEmail.createdAt)} to {lastEmail.recipient}
                    </Badge>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
