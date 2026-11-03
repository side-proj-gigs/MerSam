'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { INVOICE_STATUSES, type InvoiceStatus } from '@core/entities';
import type { InvoiceSummary } from '@app-layer/ports';
import { formatDate, formatMoney } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, FilterChips, type Column } from '@/components/admin/data-table';

export default function InvoicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState<InvoiceStatus | undefined>();

  const columns: Column<InvoiceSummary>[] = [
    {
      key: 'number',
      header: 'Invoice',
      render: (invoice) => (
        <div>
          <p className="font-mono font-semibold text-[var(--text-primary)]">
            {invoice.invoiceNumber}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{formatDate(invoice.issuedOn)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (invoice) => (
        <span className="text-[var(--text-secondary)]">{invoice.customerName}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (invoice) => <StatusBadge status={invoice.status} /> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (invoice) => (
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
          {formatMoney(invoice.totalMinor, invoice.currency)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      hideBelow: 'sm',
      render: (invoice) => (
        <span
          className={
            invoice.balanceMinor > 0
              ? 'font-semibold tabular-nums text-[var(--color-warning)]'
              : 'tabular-nums text-[var(--color-success)]'
          }
        >
          {formatMoney(invoice.balanceMinor, invoice.currency)}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      align: 'right',
      hideBelow: 'lg',
      render: (invoice) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {invoice.dueOn ? formatDate(invoice.dueOn) : 'On receipt'}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Raise, issue and settle invoices, with PDF and Word on every one."
        action={
          <ButtonLink
            href="/admin/invoices/new"
            variant="gold"
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            New invoice
          </ButtonLink>
        }
      />

      <div className="mb-4">
        <FilterChips
          options={INVOICE_STATUSES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      <DataTable<InvoiceSummary>
        endpoint="/api/admin/invoices"
        queryKey="invoices"
        columns={columns}
        rowKey={(invoice) => invoice.id}
        onRowClick={(invoice) => router.push(`/admin/invoices/${invoice.id}`)}
        searchPlaceholder="Search by number, customer or reference"
        filters={{ status }}
        emptyTitle="No invoices yet"
        emptyDescription="Raise your first invoice to see it here."
      />
    </>
  );
}
