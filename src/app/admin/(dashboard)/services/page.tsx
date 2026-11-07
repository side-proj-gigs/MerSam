'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Page, ServiceCategory, ServiceWithCategory } from '@core/entities';
import { api } from '@/lib/api-client';
import { formatMoney, formatMoneyPlain, newIdempotencyKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Badge, Dialog } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/confirm';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, type Column } from '@/components/admin/data-table';

const ICON_KEYS = [
  'droplets', 'drill', 'filter', 'gauge', 'layers', 'radar',
  'search', 'shower-head', 'spline', 'sun', 'users', 'waves', 'wrench',
];

export default function ServicesAdminPage() {
  const [editing, setEditing] = useState<ServiceWithCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<ServiceWithCategory>[] = [
    {
      key: 'name',
      header: 'Service',
      render: (service) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{service.name}</p>
          <p className="text-xs text-[var(--text-muted)]">/{service.slug}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelow: 'md',
      render: (service) =>
        service.category ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${service.category.accentColor}1f`,
              color: service.category.accentColor,
            }}
          >
            {service.category.name}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">None</span>
        ),
    },
    {
      key: 'price',
      header: 'From',
      hideBelow: 'sm',
      align: 'right',
      render: (service) => (
        <span className="tabular-nums text-[var(--text-secondary)]">
          {service.startingPriceMinor !== null ? formatMoney(service.startingPriceMinor) : 'Quoted'}
        </span>
      ),
    },
    {
      key: 'flags',
      header: 'Status',
      render: (service) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={service.isActive ? 'success' : 'neutral'}>
            {service.isActive ? 'Live' : 'Hidden'}
          </Badge>
          {service.isFeatured && <Badge tone="brand">Featured</Badge>}
        </div>
      ),
    },
    {
      key: 'view',
      header: '',
      align: 'right',
      render: (service) => (
        <a
          href={`/services/${service.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-grid size-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          aria-label={`View ${service.name} on the website`}
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Services"
        description="What appears on the website, in the quote form and in the navigation."
        action={
          <Button
            variant="gold"
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            Add service
          </Button>
        }
      />

      <DataTable<ServiceWithCategory>
        endpoint="/api/admin/services"
        queryKey="services"
        columns={columns}
        rowKey={(service) => service.id}
        onRowClick={setEditing}
        searchPlaceholder="Search services"
        emptyTitle="No services yet"
        pageSize={50}
      />

      {(creating || editing) && (
        <ServiceDialog
          service={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ServiceDialog({
  service,
  onClose,
}: {
  service?: ServiceWithCategory;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const askConfirm = useConfirm();
  const editing = Boolean(service);
  const [idempotencyKey] = useState(() => newIdempotencyKey('service'));

  const categories = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => api.get<Page<ServiceCategory>>('/api/admin/service-categories'),
    staleTime: 300_000,
  });

  const [form, setForm] = useState({
    name: service?.name ?? '',
    slug: service?.slug ?? '',
    categoryId: service?.categoryId ?? '',
    tagline: service?.tagline ?? '',
    summary: service?.summary ?? '',
    body: service?.body ?? '',
    iconKey: service?.iconKey ?? 'droplets',
    heroImageUrl: service?.heroImageUrl ?? '',
    startingPrice:
      service?.startingPriceMinor != null ? formatMoneyPlain(service.startingPriceMinor) : '',
    priceNote: service?.priceNote ?? '',
    turnaround: service?.turnaround ?? '',
    sortOrder: String(service?.sortOrder ?? 0),
    isActive: service?.isActive ?? true,
    isFeatured: service?.isFeatured ?? false,
    deliverables: (service?.deliverables ?? []).join('\n'),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const payload = () => ({
    name: form.name,
    slug: form.slug || undefined,
    categoryId: form.categoryId || null,
    tagline: form.tagline,
    summary: form.summary,
    body: form.body,
    iconKey: form.iconKey,
    heroImageUrl: form.heroImageUrl,
    startingPriceMinor: form.startingPrice ? form.startingPrice : null,
    priceNote: form.priceNote,
    turnaround: form.turnaround,
    sortOrder: Number(form.sortOrder) || 0,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    deliverables: form.deliverables.split('\n').map((line) => line.trim()).filter(Boolean),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.patch(`/api/admin/services/${service!.id}`, payload())
        : api.post('/api/admin/services', payload(), { idempotencyKey }),
    onSuccess: () => {
      toast.success(editing ? 'Service updated' : 'Service added');
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/services/${service!.id}`),
    onSuccess: () => {
      toast.success('Service removed');
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? `Edit ${service!.name}` : 'Add a service'}
      description="Changes appear on the website within five minutes."
      size="xl"
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              className="mr-auto text-[var(--color-danger)]"
              loading={remove.isPending}
              onClick={async () => {
                const confirmed = await askConfirm({
                  title: `Remove ${service!.name}?`,
                  description:
                    'The service disappears from the website straight away, along with its own page.',
                  detail: 'Enquiries already received about it are kept.',
                  confirmLabel: 'Remove service',
                });
                if (confirmed) remove.mutate();
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={save.isPending}
            disabled={form.name.trim().length < 2}
            onClick={() => save.mutate()}
          >
            {editing ? 'Save changes' : 'Add service'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input
          label="Web address"
          value={form.slug}
          onChange={(e) => set('slug', e.target.value)}
          hint="Derived from the name when left blank"
        />
        <Select
          label="Category"
          value={form.categoryId}
          onChange={(e) => set('categoryId', e.target.value)}
        >
          <option value="">No category</option>
          {categories.data?.items.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          label="Icon"
          value={form.iconKey}
          onChange={(e) => set('iconKey', e.target.value)}
          options={ICON_KEYS.map((value) => ({ value, label: value.replace(/-/g, ' ') }))}
        />
        <Input
          label="Tagline"
          wrapperClassName="sm:col-span-2"
          value={form.tagline}
          onChange={(e) => set('tagline', e.target.value)}
          placeholder="Raw water in, potable water out"
        />
      </div>

      <Textarea
        label="Summary"
        wrapperClassName="mt-4"
        rows={3}
        value={form.summary}
        onChange={(e) => set('summary', e.target.value)}
        hint="Shown on the service card and in search results"
      />

      <Textarea
        label="Full description"
        wrapperClassName="mt-4"
        rows={8}
        value={form.body}
        onChange={(e) => set('body', e.target.value)}
        hint="Separate paragraphs with a blank line"
      />

      <Textarea
        label="What the client receives"
        wrapperClassName="mt-4"
        rows={5}
        value={form.deliverables}
        onChange={(e) => set('deliverables', e.target.value)}
        hint="One item per line"
      />

      <Input
        label="Hero image URL"
        wrapperClassName="mt-4"
        value={form.heroImageUrl}
        onChange={(e) => set('heroImageUrl', e.target.value)}
        hint="Paste a URL from the media library or an external CDN"
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input
          label="Starting price"
          value={form.startingPrice}
          onChange={(e) => set('startingPrice', e.target.value)}
          inputMode="decimal"
          hint="Blank means quoted per site"
        />
        <Input
          label="Turnaround"
          value={form.turnaround}
          onChange={(e) => set('turnaround', e.target.value)}
          placeholder="2 to 5 weeks"
        />
        <Input
          label="Sort order"
          value={form.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          inputMode="numeric"
        />
      </div>

      <Input
        label="Price note"
        wrapperClassName="mt-4"
        value={form.priceNote}
        onChange={(e) => set('priceNote', e.target.value)}
        placeholder="Quoted after the water analysis"
      />

      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <Checkbox
          label="Live on the website"
          description="Unticking hides it everywhere without deleting it"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        <Checkbox
          label="Featured"
          description="Appears on the home page and in the menu"
          checked={form.isFeatured}
          onChange={(e) => set('isFeatured', e.target.checked)}
        />
      </div>
    </Dialog>
  );
}
