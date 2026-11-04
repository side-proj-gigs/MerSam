'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '@core/entities';
import { api } from '@/lib/api-client';
import { formatDate, newIdempotencyKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Badge, Dialog } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, type Column } from '@/components/admin/data-table';

const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' },
  { value: 'institution', label: 'Institution' },
  { value: 'community', label: 'Community' },
];

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  contactPerson: '',
  address: '',
  city: '',
  region: '',
  clientType: 'individual',
  notes: '',
};

export default function ClientsPage() {
  const [creating, setCreating] = useState(false);

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      render: (client) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{client.name}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{client.reference}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (client) => (
        <a href={`tel:${client.phone}`} className="text-[var(--accent)] hover:underline">
          {client.phone}
        </a>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'sm',
      render: (client) => <Badge tone="neutral">{client.clientType}</Badge>,
    },
    {
      key: 'location',
      header: 'Location',
      hideBelow: 'lg',
      render: (client) => (
        <span className="text-[var(--text-secondary)]">
          {[client.city, client.region].filter(Boolean).join(', ') || client.address || 'Not given'}
        </span>
      ),
    },
    {
      key: 'added',
      header: 'Added',
      hideBelow: 'md',
      align: 'right',
      render: (client) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {formatDate(client.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone we have worked for, with their jobs and invoices behind them."
        action={
          <Button
            variant="gold"
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            Add client
          </Button>
        }
      />

      <DataTable<Client>
        endpoint="/api/admin/clients"
        queryKey="clients"
        columns={columns}
        rowKey={(client) => client.id}
        searchPlaceholder="Search by name, phone or reference"
        emptyTitle="No clients yet"
        emptyDescription="Convert an enquiry or add a client directly."
      />

      {creating && <ClientDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function ClientDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => newIdempotencyKey('client'));

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      api.post<Client>('/api/admin/clients', form, { idempotencyKey }),
    onSuccess: (client) => {
      toast.success(`${client.name} added as ${client.reference}`);
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (error: Error & { fieldErrors?: Record<string, string> }) => {
      setErrors(error.fieldErrors ?? {});
      toast.error(error.message);
    },
  });

  const valid = form.name.trim().length > 1 && form.phone.replace(/\D/g, '').length >= 9;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a client"
      description="A client on the same phone number will be reused rather than duplicated."
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
            Save client
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name}
          placeholder="Kwame Mensah"
        />
        <Input
          label="Phone"
          required
          type="tel"
          value={form.phone}
          onChange={(event) => set('phone', event.target.value)}
          error={errors.phone}
          placeholder="055 183 0101"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          error={errors.email}
        />
        <Input
          label="Contact person"
          value={form.contactPerson}
          onChange={(event) => set('contactPerson', event.target.value)}
          hint="For a business or institution"
        />
        <Select
          label="Type"
          value={form.clientType}
          onChange={(event) => set('clientType', event.target.value)}
          options={CLIENT_TYPES}
        />
        <Input
          label="City"
          value={form.city}
          onChange={(event) => set('city', event.target.value)}
          placeholder="Accra"
        />
        <Input
          label="Region"
          value={form.region}
          onChange={(event) => set('region', event.target.value)}
          placeholder="Greater Accra"
        />
        <Input
          label="Address"
          value={form.address}
          onChange={(event) => set('address', event.target.value)}
          placeholder="Spintex Road"
        />
      </div>

      <Textarea
        label="Notes"
        wrapperClassName="mt-4"
        rows={3}
        value={form.notes}
        onChange={(event) => set('notes', event.target.value)}
        placeholder="Four unit block, access through the side gate."
      />
    </Dialog>
  );
}
