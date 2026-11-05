'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PROPOSAL_STATUSES, type ProposalStatus } from '@core/entities';
import type { ProposalSummary } from '@app-layer/ports';
import { formatDate, formatMoney } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, FilterChips, type Column } from '@/components/admin/data-table';

export default function ProposalsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ProposalStatus | undefined>();

  const columns: Column<ProposalSummary>[] = [
    {
      key: 'number',
      header: 'Proposal',
      render: (proposal) => (
        <div>
          <p className="font-mono font-semibold text-[var(--text-primary)]">
            {proposal.proposalNumber}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{formatDate(proposal.issuedOn)}</p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (proposal) => (
        <span className="text-[var(--text-secondary)]">{proposal.clientName}</span>
      ),
    },
    {
      key: 'title',
      header: 'For',
      hideBelow: 'lg',
      render: (proposal) => (
        <span className="text-[var(--text-secondary)]">{proposal.title}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (proposal) => <StatusBadge status={proposal.status} /> },
    {
      key: 'valid',
      header: 'Valid until',
      hideBelow: 'sm',
      align: 'right',
      render: (proposal) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {proposal.validUntil ? formatDate(proposal.validUntil) : 'On request'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (proposal) => (
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
          {formatMoney(proposal.totalMinor, proposal.currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Proposals"
        description="Priced letters to potential clients, downloadable as PDF or Word and sendable by email."
        action={
          <ButtonLink
            href="/admin/proposals/new"
            variant="gold"
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            New proposal
          </ButtonLink>
        }
      />

      <div className="mb-4">
        <FilterChips
          options={PROPOSAL_STATUSES.map((value) => ({ value, label: value }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      <DataTable<ProposalSummary>
        endpoint="/api/admin/proposals"
        queryKey="proposals"
        columns={columns}
        rowKey={(proposal) => proposal.id}
        onRowClick={(proposal) => router.push(`/admin/proposals/${proposal.id}`)}
        searchPlaceholder="Search by number, client or title"
        filters={{ status }}
        emptyTitle="No proposals yet"
        emptyDescription="Write your first proposal to a potential client."
      />
    </>
  );
}
