import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { repositories } from '@infra/deps';
import { formatDate, formatMoney, formatMoneyPlain, paragraphs } from '@/lib/utils';
import { Badge, Card, CardHeader, StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { ReportActions } from '@/components/admin/report-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const report = await repositories().workReports.findById((await params).id).catch(() => null);
  return { title: report ? `Report ${report.reportNumber}` : 'Work report' };
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await repositories().workReports.findById(id).catch(() => null);
  if (!report) notFound();

  const sections = [
    { number: 1, heading: 'Introduction', body: report.introduction },
    { number: 2, heading: 'Description of Work Performed', body: report.workPerformed },
    { number: 4, heading: 'Payment Confirmation', body: report.paymentNote },
    { number: 5, heading: 'Work Completion Confirmation', body: report.completionNote },
    { number: 6, heading: 'Appreciation', body: report.appreciation },
  ];

  return (
    <>
      <PageHeader
        title={report.title}
        description={`${report.reportNumber} for ${report.clientName}, ${formatDate(report.reportDate, 'long')}`}
        action={<ReportActions report={report} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Report header"
              action={<StatusBadge status={report.status} />}
            />
            <dl className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ['Report No.', report.reportNumber],
                ['Client Name', report.clientName],
                ['Date of Work', formatDate(report.dateOfWork, 'long')],
                ['Service Category', report.serviceCategory],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {label}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {sections.slice(0, 2).map((section) => (
            <Card key={section.number}>
              <CardHeader title={`${section.number}. ${section.heading}`} />
              <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(section.body).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>
            </Card>
          ))}

          <Card>
            <CardHeader title="3. Cost and Payment Breakdown" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  <th className="px-5 py-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Description
                  </th>
                  <th className="px-5 py-2.5 text-right text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Amount ({report.currency})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {report.costLines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-5 py-2.5">{line.description}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {formatMoneyPlain(line.amountMinor)}
                    </td>
                  </tr>
                ))}
                {[
                  ['Total Cost of Work', report.totalCostMinor, true],
                  ['Total Amount Paid', report.totalPaidMinor, false],
                  ['Outstanding Balance', report.outstandingMinor, true],
                ].map(([label, value, bold]) => (
                  <tr key={label as string} className="bg-[var(--surface-sunken)]">
                    <td className={`px-5 py-2.5 ${bold ? 'font-semibold' : ''}`}>{label as string}</td>
                    <td className={`px-5 py-2.5 text-right tabular-nums ${bold ? 'font-bold' : ''}`}>
                      {formatMoneyPlain(value as number)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {sections.slice(2).map((section) => (
            <Card key={section.number}>
              <CardHeader title={`${section.number}. ${section.heading}`} />
              <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(section.body).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Payment status" />
            <div className="flex flex-col items-center gap-3 p-6">
              <Badge
                tone={
                  report.paymentState === 'fully_paid'
                    ? 'success'
                    : report.paymentState === 'part_payment'
                      ? 'warning'
                      : 'danger'
                }
                className="px-4 py-1.5 text-xs"
              >
                {report.paymentState.replace(/_/g, ' ')}
              </Badge>
              <p className="font-display text-3xl font-semibold text-[var(--brand)]">
                {formatMoney(report.totalCostMinor, report.currency)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {formatMoney(report.totalPaidMinor, report.currency)} received
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Signature block" />
            <dl className="flex flex-col gap-3 p-5 text-sm">
              {[
                ['Prepared by', report.preparedBy],
                ['Authorised representative', report.authorisedRepresentative ?? 'To be signed'],
                ['Date of report', formatDate(report.reportDate, 'long')],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
