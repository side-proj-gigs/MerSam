'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { FaqEntry, ProjectShowcase, Testimonial } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn, formatDate, newIdempotencyKey, toDateInput, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/field';
import { Badge, Dialog } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, type Column } from '@/components/admin/data-table';

type Tab = 'testimonials' | 'projects' | 'faqs';

const TABS: { value: Tab; label: string; description: string }[] = [
  { value: 'testimonials', label: 'Testimonials', description: 'What clients say, shown on the home and about pages.' },
  { value: 'projects', label: 'Projects', description: 'Completed work with its figures, shown in the portfolio.' },
  { value: 'faqs', label: 'FAQs', description: 'Questions and answers, also fed to search engines.' },
];

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('testimonials');
  const active = TABS.find((item) => item.value === tab)!;

  return (
    <>
      <PageHeader title="Website content" description={active.description} />

      <div
        className="mb-5 inline-flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1"
        role="tablist"
      >
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === item.value
                ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'testimonials' && <TestimonialsTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'faqs' && <FaqsTab />}
    </>
  );
}

/** Shared save and delete behaviour for every collection on this page. */
function useResource(resource: string, queryKey: string, onDone: () => void) {
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => newIdempotencyKey(resource));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id
        ? api.patch(`/api/admin/${resource}/${id}`, body)
        : api.post(`/api/admin/${resource}`, body, { idempotencyKey }),
    onSuccess: () => {
      toast.success('Saved');
      void invalidate();
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/${resource}/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      void invalidate();
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { save, remove };
}

/* --------------------------------------------------------- testimonials */

function TestimonialsTab() {
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<Testimonial>[] = [
    {
      key: 'author',
      header: 'Author',
      render: (item) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{item.authorName}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {[item.authorRole, item.location].filter(Boolean).join(', ')}
          </p>
        </div>
      ),
    },
    {
      key: 'quote',
      header: 'Quote',
      hideBelow: 'md',
      render: (item) => (
        <span className="text-[var(--text-secondary)]">{truncate(item.quote, 80)}</span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      hideBelow: 'sm',
      render: (item) => (
        <span className="flex items-center gap-0.5">
          {Array.from({ length: item.rating }, (_, index) => (
            <Star key={index} className="size-3.5 fill-gold-500 text-gold-500" aria-hidden />
          ))}
          <span className="sr-only">{item.rating} out of 5</span>
        </span>
      ),
    },
    {
      key: 'published',
      header: 'Status',
      render: (item) => (
        <Badge tone={item.isPublished ? 'success' : 'neutral'}>
          {item.isPublished ? 'Live' : 'Hidden'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="gold"
          onClick={() => setCreating(true)}
          leadingIcon={<Plus className="size-4" aria-hidden />}
        >
          Add testimonial
        </Button>
      </div>

      <DataTable<Testimonial>
        endpoint="/api/admin/testimonials"
        queryKey="testimonials"
        columns={columns}
        rowKey={(item) => item.id}
        onRowClick={setEditing}
        searchPlaceholder="Search testimonials"
        emptyTitle="No testimonials yet"
        pageSize={50}
      />

      {(creating || editing) && (
        <TestimonialDialog
          item={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function TestimonialDialog({ item, onClose }: { item?: Testimonial; onClose: () => void }) {
  const { save, remove } = useResource('testimonials', 'testimonials', onClose);
  const [form, setForm] = useState({
    authorName: item?.authorName ?? '',
    authorRole: item?.authorRole ?? '',
    location: item?.location ?? '',
    quote: item?.quote ?? '',
    rating: String(item?.rating ?? 5),
    sortOrder: String(item?.sortOrder ?? 0),
    isPublished: item?.isPublished ?? true,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? 'Edit testimonial' : 'Add a testimonial'}
      size="lg"
      footer={
        <>
          {item && (
            <Button
              variant="ghost"
              className="mr-auto text-[var(--color-danger)]"
              loading={remove.isPending}
              onClick={() => confirm('Delete this testimonial?') && remove.mutate(item.id)}
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
            disabled={!form.authorName.trim() || form.quote.trim().length < 10}
            onClick={() =>
              save.mutate({
                id: item?.id,
                body: {
                  ...form,
                  rating: Number(form.rating) || 5,
                  sortOrder: Number(form.sortOrder) || 0,
                },
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Author name"
          required
          value={form.authorName}
          onChange={(e) => set('authorName', e.target.value)}
        />
        <Input
          label="Role"
          value={form.authorRole}
          onChange={(e) => set('authorRole', e.target.value)}
          placeholder="Homeowner"
        />
        <Input
          label="Location"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="East Legon, Accra"
        />
        <Input
          label="Rating (1 to 5)"
          value={form.rating}
          onChange={(e) => set('rating', e.target.value)}
          inputMode="numeric"
        />
      </div>

      <Textarea
        label="Quote"
        wrapperClassName="mt-4"
        rows={5}
        required
        value={form.quote}
        onChange={(e) => set('quote', e.target.value)}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Sort order"
          value={form.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          inputMode="numeric"
        />
        <Checkbox
          label="Published"
          checked={form.isPublished}
          onChange={(e) => set('isPublished', e.target.checked)}
        />
      </div>
    </Dialog>
  );
}

/* -------------------------------------------------------------- projects */

function ProjectsTab() {
  const [editing, setEditing] = useState<ProjectShowcase | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<ProjectShowcase>[] = [
    {
      key: 'title',
      header: 'Project',
      render: (item) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
          <p className="text-xs text-[var(--text-muted)]">{item.location}</p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      hideBelow: 'md',
      render: (item) => <span className="text-[var(--text-secondary)]">{item.client}</span>,
    },
    {
      key: 'completed',
      header: 'Completed',
      hideBelow: 'sm',
      render: (item) => (
        <span className="text-xs text-[var(--text-muted)]">
          {item.completedOn ? formatDate(item.completedOn) : 'Ongoing'}
        </span>
      ),
    },
    {
      key: 'published',
      header: 'Status',
      render: (item) => (
        <Badge tone={item.isPublished ? 'success' : 'neutral'}>
          {item.isPublished ? 'Live' : 'Hidden'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="gold"
          onClick={() => setCreating(true)}
          leadingIcon={<Plus className="size-4" aria-hidden />}
        >
          Add project
        </Button>
      </div>

      <DataTable<ProjectShowcase>
        endpoint="/api/admin/projects"
        queryKey="projects"
        columns={columns}
        rowKey={(item) => item.id}
        onRowClick={setEditing}
        searchPlaceholder="Search projects"
        emptyTitle="No projects yet"
        pageSize={50}
      />

      {(creating || editing) && (
        <ProjectDialog
          item={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ProjectDialog({ item, onClose }: { item?: ProjectShowcase; onClose: () => void }) {
  const { save, remove } = useResource('projects', 'projects', onClose);
  const [form, setForm] = useState({
    title: item?.title ?? '',
    client: item?.client ?? '',
    location: item?.location ?? '',
    summary: item?.summary ?? '',
    body: item?.body ?? '',
    coverImageUrl: item?.coverImageUrl ?? '',
    completedOn: toDateInput(item?.completedOn),
    sortOrder: String(item?.sortOrder ?? 0),
    isPublished: item?.isPublished ?? true,
    stats: (item?.stats ?? []).map((stat) => `${stat.label}: ${stat.value}`).join('\n'),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? 'Edit project' : 'Add a project'}
      size="xl"
      footer={
        <>
          {item && (
            <Button
              variant="ghost"
              className="mr-auto text-[var(--color-danger)]"
              loading={remove.isPending}
              onClick={() => confirm('Delete this project?') && remove.mutate(item.id)}
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
            disabled={form.title.trim().length < 3}
            onClick={() =>
              save.mutate({
                id: item?.id,
                body: {
                  ...form,
                  completedOn: form.completedOn || null,
                  sortOrder: Number(form.sortOrder) || 0,
                  stats: form.stats
                    .split('\n')
                    .map((line) => line.split(':'))
                    .filter((parts) => parts.length >= 2 && parts[0]!.trim() && parts[1]!.trim())
                    .map((parts) => ({
                      label: parts[0]!.trim(),
                      value: parts.slice(1).join(':').trim(),
                    })),
                },
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" required value={form.title} onChange={(e) => set('title', e.target.value)} />
        <Input label="Client" value={form.client} onChange={(e) => set('client', e.target.value)} />
        <Input
          label="Location"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
        />
        <Input
          label="Completed on"
          type="date"
          value={form.completedOn}
          onChange={(e) => set('completedOn', e.target.value)}
        />
      </div>

      <Textarea
        label="Summary"
        wrapperClassName="mt-4"
        rows={3}
        value={form.summary}
        onChange={(e) => set('summary', e.target.value)}
      />

      <Textarea
        label="Full write-up"
        wrapperClassName="mt-4"
        rows={7}
        value={form.body}
        onChange={(e) => set('body', e.target.value)}
        hint="Separate paragraphs with a blank line"
      />

      <Textarea
        label="Headline figures"
        wrapperClassName="mt-4"
        rows={4}
        value={form.stats}
        onChange={(e) => set('stats', e.target.value)}
        hint="One per line, as Label: Value"
      />

      <Input
        label="Cover image URL"
        wrapperClassName="mt-4"
        value={form.coverImageUrl}
        onChange={(e) => set('coverImageUrl', e.target.value)}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Sort order"
          value={form.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          inputMode="numeric"
        />
        <Checkbox
          label="Published"
          checked={form.isPublished}
          onChange={(e) => set('isPublished', e.target.checked)}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ FAQs */

function FaqsTab() {
  const [editing, setEditing] = useState<FaqEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<FaqEntry>[] = [
    {
      key: 'question',
      header: 'Question',
      render: (item) => (
        <span className="font-medium text-[var(--text-primary)]">{truncate(item.question, 70)}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelow: 'sm',
      render: (item) => <Badge tone="neutral">{item.category}</Badge>,
    },
    {
      key: 'published',
      header: 'Status',
      render: (item) => (
        <Badge tone={item.isPublished ? 'success' : 'neutral'}>
          {item.isPublished ? 'Live' : 'Hidden'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="gold"
          onClick={() => setCreating(true)}
          leadingIcon={<Plus className="size-4" aria-hidden />}
        >
          Add question
        </Button>
      </div>

      <DataTable<FaqEntry>
        endpoint="/api/admin/faqs"
        queryKey="faqs"
        columns={columns}
        rowKey={(item) => item.id}
        onRowClick={setEditing}
        searchPlaceholder="Search questions"
        emptyTitle="No questions yet"
        pageSize={50}
      />

      {(creating || editing) && (
        <FaqDialog
          item={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function FaqDialog({ item, onClose }: { item?: FaqEntry; onClose: () => void }) {
  const { save, remove } = useResource('faqs', 'faqs', onClose);
  const [form, setForm] = useState({
    question: item?.question ?? '',
    answer: item?.answer ?? '',
    category: item?.category ?? 'General',
    sortOrder: String(item?.sortOrder ?? 0),
    isPublished: item?.isPublished ?? true,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? 'Edit question' : 'Add a question'}
      size="lg"
      footer={
        <>
          {item && (
            <Button
              variant="ghost"
              className="mr-auto text-[var(--color-danger)]"
              loading={remove.isPending}
              onClick={() => confirm('Delete this question?') && remove.mutate(item.id)}
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
            disabled={form.question.trim().length < 5 || form.answer.trim().length < 10}
            onClick={() =>
              save.mutate({
                id: item?.id,
                body: { ...form, sortOrder: Number(form.sortOrder) || 0 },
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <Textarea
        label="Question"
        rows={2}
        required
        value={form.question}
        onChange={(e) => set('question', e.target.value)}
      />
      <Textarea
        label="Answer"
        wrapperClassName="mt-4"
        rows={6}
        required
        value={form.answer}
        onChange={(e) => set('answer', e.target.value)}
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input
          label="Category"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
        />
        <Input
          label="Sort order"
          value={form.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          inputMode="numeric"
        />
        <Checkbox
          label="Published"
          checked={form.isPublished}
          onChange={(e) => set('isPublished', e.target.checked)}
        />
      </div>
    </Dialog>
  );
}
