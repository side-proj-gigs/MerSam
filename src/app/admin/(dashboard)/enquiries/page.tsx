'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '@core/entities';
import { api } from '@/lib/api-client';
import { formatRelative, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/field';
import { Badge, Dialog, StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, FilterChips, type Column } from '@/components/admin/data-table';

const URGENCY_TONES = {
  emergency: 'danger',
  urgent: 'warning',
  this_week: 'accent',
  flexible: 'neutral',
} as const;

export default function EnquiriesPage() {
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const [selected, setSelected] = useState<Lead | null>(null);

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Enquiry',
      render: (lead) => (
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">{lead.fullName}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{lead.reference}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: 'md',
      render: (lead) => (
        <div>
          <a
            href={`tel:${lead.phone}`}
            className="text-[var(--accent)] hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {lead.phone}
          </a>
          {lead.location && <p className="text-xs text-[var(--text-muted)]">{lead.location}</p>}
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      hideBelow: 'lg',
      render: (lead) => (
        <span className="text-[var(--text-secondary)]">{lead.serviceName ?? 'Not specified'}</span>
      ),
    },
    {
      key: 'urgency',
      header: 'Urgency',
      hideBelow: 'sm',
      render: (lead) => (
        <Badge tone={URGENCY_TONES[lead.urgency]}>{lead.urgency.replace(/_/g, ' ')}</Badge>
      ),
    },
    { key: 'status', header: 'Status', render: (lead) => <StatusBadge status={lead.status} /> },
    {
      key: 'created',
      header: 'Received',
      hideBelow: 'md',
      align: 'right',
      render: (lead) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {formatRelative(lead.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Every quote request from the website, WhatsApp and the phone."
      />

      <div className="mb-4">
        <FilterChips
          options={LEAD_STATUSES.map((value) => ({ value, label: value }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      <DataTable<Lead>
        endpoint="/api/admin/leads"
        queryKey="leads"
        columns={columns}
        rowKey={(lead) => lead.id}
        onRowClick={setSelected}
        searchPlaceholder="Search by name, phone, reference or message"
        filters={{ status }}
        emptyTitle="No enquiries yet"
        emptyDescription="New quote requests from the website will land here."
      />

      {selected && <LeadDetail lead={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function LeadDetail({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [note, setNote] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const update = useMutation({
    mutationFn: () => api.patch<Lead>(`/api/admin/leads/${lead.id}`, { status, note: note || undefined }),
    onSuccess: () => {
      toast.success('Enquiry updated');
      invalidate();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const convert = useMutation({
    // Idempotent on the server, so a double click cannot create two clients.
    mutationFn: () =>
      api.post<{ client: { reference: string; name: string } }>(
        `/api/admin/leads/${lead.id}/convert`,
        {},
      ),
    onSuccess: (result) => {
      toast.success(`Converted to client ${result.client.reference}`);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={lead.fullName}
      description={`${lead.reference}, received ${formatRelative(lead.createdAt)}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!lead.clientId && (
            <Button
              variant="outline"
              loading={convert.isPending}
              onClick={() => convert.mutate()}
              leadingIcon={<UserPlus className="size-4" aria-hidden />}
            >
              Convert to client
            </Button>
          )}
          <Button
            variant="gold"
            loading={update.isPending}
            onClick={() => update.mutate()}
            disabled={status === lead.status && !note.trim()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          { term: 'Phone', value: lead.phone, href: `tel:${lead.phone}` },
          { term: 'Email', value: lead.email ?? 'Not given', href: lead.email ? `mailto:${lead.email}` : undefined },
          { term: 'Location', value: lead.location || 'Not given' },
          { term: 'Service', value: lead.serviceName ?? 'Not specified' },
          { term: 'Urgency', value: lead.urgency.replace(/_/g, ' ') },
          { term: 'Source', value: lead.source.replace(/_/g, ' ') },
        ].map((row) => (
          <div key={row.term}>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {row.term}
            </dt>
            <dd className="mt-0.5 text-sm capitalize text-[var(--text-primary)]">
              {row.href ? (
                <a href={row.href} className="text-[var(--accent)] hover:underline">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          What they wrote
        </p>
        <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-[var(--surface-sunken)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {lead.message}
        </p>
      </div>

      {lead.internalNotes && (
        <div className="mt-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Internal notes
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
            {lead.internalNotes}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as LeadStatus)}
          options={LEAD_STATUSES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
        />
        <a
          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
            `Hello ${lead.fullName.split(' ')[0]}, this is MerSam following up on your enquiry ${lead.reference}.`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-end"
        >
          <span className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white transition-transform hover:scale-[1.01]">
            <Phone className="size-4" aria-hidden />
            Reply on WhatsApp
          </span>
        </a>
      </div>

      <Textarea
        label="Add a note"
        wrapperClassName="mt-4"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={`Called ${truncate(lead.fullName, 20)}, visiting site on Thursday.`}
      />
    </Dialog>
  );
}
