'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { JOB_STATUSES, type Client, type JobStatus, type JobWithRelations, type Page } from '@core/entities';
import { api } from '@/lib/api-client';
import { formatDate, newIdempotencyKey, toDateInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Dialog, StatusBadge } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, FilterChips, type Column } from '@/components/admin/data-table';

export default function JobsPage() {
  const [status, setStatus] = useState<JobStatus | undefined>();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<JobWithRelations | null>(null);

  const columns: Column<JobWithRelations>[] = [
    {
      key: 'title',
      header: 'Job',
      render: (job) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{job.title}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{job.reference}</p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (job) => <span className="text-[var(--text-secondary)]">{job.clientName}</span>,
    },
    {
      key: 'service',
      header: 'Service',
      hideBelow: 'lg',
      render: (job) => (
        <span className="text-[var(--text-secondary)]">{job.serviceName ?? 'General'}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (job) => <StatusBadge status={job.status} /> },
    {
      key: 'scheduled',
      header: 'Scheduled',
      hideBelow: 'md',
      align: 'right',
      render: (job) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {job.scheduledFor ? formatDate(job.scheduledFor) : 'Not set'}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Work on site, from scheduled through to completed."
        action={
          <Button
            variant="gold"
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            New job
          </Button>
        }
      />

      <div className="mb-4">
        <FilterChips
          options={JOB_STATUSES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      <DataTable<JobWithRelations>
        endpoint="/api/admin/jobs"
        queryKey="jobs"
        columns={columns}
        rowKey={(job) => job.id}
        onRowClick={setSelected}
        searchPlaceholder="Search by title, reference or client"
        filters={{ status }}
        emptyTitle="No jobs yet"
        emptyDescription="Schedule work against a client to see it here."
      />

      {creating && <JobDialog onClose={() => setCreating(false)} />}
      {selected && <JobDetail job={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function useClients() {
  return useQuery({
    queryKey: ['clients', 'picker'],
    queryFn: () => api.get<Page<Client>>('/api/admin/clients?pageSize=100'),
    staleTime: 120_000,
  });
}

function JobDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const clients = useClients();
  const [form, setForm] = useState({
    clientId: '',
    title: '',
    description: '',
    siteAddress: '',
    scheduledFor: '',
    status: 'scheduled' as JobStatus,
  });
  const [idempotencyKey] = useState(() => newIdempotencyKey('job'));

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/admin/jobs', {
        ...form,
        scheduledFor: form.scheduledFor || null,
      }, { idempotencyKey }),
    onSuccess: () => {
      toast.success('Job scheduled');
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid = form.clientId && form.title.trim().length > 2;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Schedule a job"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={create.isPending}
            disabled={!valid}
            onClick={() => create.mutate()}
          >
            Create job
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Select
          label="Client"
          required
          value={form.clientId}
          onChange={(event) => set('clientId', event.target.value)}
        >
          <option value="">
            {clients.isPending ? 'Loading clients' : 'Choose a client'}
          </option>
          {clients.data?.items.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.reference})
            </option>
          ))}
        </Select>

        <Input
          label="Job title"
          required
          value={form.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder="Sewage pipe unblocking and section re-lay"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Scheduled for"
            type="date"
            value={form.scheduledFor}
            onChange={(event) => set('scheduledFor', event.target.value)}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => set('status', event.target.value)}
            options={JOB_STATUSES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
          />
        </div>

        <Input
          label="Site address"
          value={form.siteAddress}
          onChange={(event) => set('siteAddress', event.target.value)}
          hint="Leave blank to use the client's address"
        />

        <Textarea
          label="Description"
          rows={4}
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="What the client reported and what we intend to do."
        />
      </div>
    </Dialog>
  );
}

function JobDetail({ job, onClose }: { job: JobWithRelations; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [completedOn, setCompletedOn] = useState(toDateInput(job.completedOn));

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/jobs/${job.id}`, {
        status,
        completedOn: completedOn || null,
      }),
    onSuccess: () => {
      toast.success('Job updated');
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={job.title}
      description={`${job.reference} for ${job.clientName}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="gold" loading={update.isPending} onClick={() => update.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      {job.description && (
        <p className="whitespace-pre-wrap rounded-xl bg-[var(--surface-sunken)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {job.description}
        </p>
      )}

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { term: 'Site address', value: job.siteAddress || 'Not given' },
          { term: 'Scheduled', value: job.scheduledFor ? formatDate(job.scheduledFor, 'long') : 'Not set' },
          { term: 'Started', value: job.startedOn ? formatDate(job.startedOn, 'long') : 'Not started' },
          { term: 'Service', value: job.serviceName ?? 'General' },
        ].map((row) => (
          <div key={row.term}>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {row.term}
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--text-primary)]">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as JobStatus)}
          options={JOB_STATUSES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
        />
        <Input
          label="Completed on"
          type="date"
          value={completedOn}
          onChange={(event) => setCompletedOn(event.target.value)}
          hint="Set automatically when you mark a job complete"
        />
      </div>
    </Dialog>
  );
}
