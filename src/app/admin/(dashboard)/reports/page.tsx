'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { WORK_REPORT_STATUSES, type WorkReport, type WorkReportStatus } from '@core/entities';
import { formatDate, formatMoney } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, FilterChips, type Column } from '@/components/admin/data-table';

export default function ReportsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<WorkReportStatus | undefined>();

  const columns: Column<WorkReport>[] = [
    {
      key: 'number',
      header: 'Report',
      render: (report) => (
        <div>
          <p className="font-mono font-semibold text-[var(--text-primary)]">
            {report.reportNumber}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{formatDate(report.reportDate)}</p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (report) => (
        <span className="text-[var(--text-secondary)]">{report.clientName}</span>
      ),
    },
    {
      key: 'category',
      header: 'Service',
      hideBelow: 'lg',
      render: (report) => (
        <span className="text-[var(--text-secondary)]">{report.serviceCategory}</span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      hideBelow: 'sm',
      render: (report) => (
        <Badge
          tone={
            report.paymentState === 'fully_paid'
              ? 'success'
              : report.paymentState === 'part_payment'
                ? 'warning'
                : 'danger'
          }
        >
          {report.paymentState.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    { key: 'status', header: 'Status', render: (report) => <StatusBadge status={report.status} /> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (report) => (
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
          {formatMoney(report.totalCostMinor, report.currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Work reports"
        description="Completion and payment reports, ready to hand to a client as PDF or Word."
        action={
          <ButtonLink
            href="/admin/reports/new"
            variant="gold"
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            New report
          </ButtonLink>
        }
      />

      <div className="mb-4">
        <FilterChips
          options={WORK_REPORT_STATUSES.map((value) => ({ value, label: value }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      <DataTable<WorkReport>
        endpoint="/api/admin/work-reports"
        queryKey="work-reports"
        columns={columns}
        rowKey={(report) => report.id}
        onRowClick={(report) => router.push(`/admin/reports/${report.id}`)}
        searchPlaceholder="Search by report number or client"
        filters={{ status }}
        emptyTitle="No reports yet"
        emptyDescription="Build one from an invoice, or write one from scratch."
      />
    </>
  );
}
