'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Eye, IdCard, Plus, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { ROLES, type Role, type User } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn, formatDate, initials } from '@/lib/utils';
import { Button, ButtonLink } from '@/components/ui/button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Dialog } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';
import { DataTable, type Column } from '@/components/admin/data-table';

export default function TeamPage() {
  const [inviting, setInviting] = useState(false);
  const [cardFor, setCardFor] = useState<User | null>(null);

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Person',
      render: (user) => (
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 text-xs font-bold text-ink-950">
              {initials(user.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--text-primary)]">{user.name}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <Badge tone={user.role === 'owner' ? 'brand' : 'neutral'}>{user.role}</Badge>,
    },
    {
      key: 'title',
      header: 'Job title',
      hideBelow: 'md',
      render: (user) => (
        <span className="text-[var(--text-secondary)]">{user.jobTitle ?? 'Not set'}</span>
      ),
    },
    {
      key: 'card',
      header: 'Digital card',
      render: (user) =>
        user.cardPublished ? (
          <Badge tone="success">Published, {user.cardViews} views</Badge>
        ) : (
          <Badge tone="neutral">Not published</Badge>
        ),
    },
    {
      key: 'lastLogin',
      header: 'Last seen',
      hideBelow: 'lg',
      align: 'right',
      render: (user) => (
        <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
          {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Team"
        description="Accounts, roles and the digital business card each person can share by QR."
        action={
          <Button
            variant="gold"
            onClick={() => setInviting(true)}
            leadingIcon={<Plus className="size-4" aria-hidden />}
          >
            Add account
          </Button>
        }
      />

      <DataTable<User>
        endpoint="/api/admin/users"
        queryKey="users"
        columns={columns}
        rowKey={(user) => user.id}
        onRowClick={setCardFor}
        searchPlaceholder="Search by name or email"
        emptyTitle="No accounts"
        pageSize={50}
      />

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      {cardFor && <CardDialog user={cardFor} onClose={() => setCardFor(null)} />}
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => api.post<User>('/api/admin/users', form),
    onSuccess: (user) => {
      toast.success(`${user.name} can now sign in`);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error: Error & { fieldErrors?: Record<string, string> }) => {
      setErrors(error.fieldErrors ?? {});
      toast.error(error.message);
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add an account"
      description="Share the password privately. They can change it after signing in."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={create.isPending}
            disabled={!form.name || !form.email || form.password.length < 10}
            onClick={() => create.mutate()}
          >
            Create account
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Input
          label="Full name"
          required
          value={form.name}
          onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
          error={errors.name}
        />
        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
          error={errors.email}
        />
        <Input
          label="Temporary password"
          required
          value={form.password}
          onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
          error={errors.password}
          hint="At least 10 characters, using three of: lowercase, uppercase, a digit, a symbol"
        />
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => setForm((c) => ({ ...c, role: e.target.value as Role }))}
          options={ROLES.map((value) => ({ value, label: value }))}
        />
      </div>
    </Dialog>
  );
}

/** Edits the person's card and previews the QR and wallpaper it produces. */
function CardDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    jobTitle: user.jobTitle ?? '',
    phone: user.phone ?? '',
    whatsapp: user.whatsapp ?? '',
    location: user.location ?? '',
    linkedinUrl: user.linkedinUrl ?? '',
    avatarUrl: user.avatarUrl ?? '',
    bio: user.bio ?? '',
    specialities: user.specialities.join('\n'),
    cardPublished: user.cardPublished,
  });
  const [slug, setSlug] = useState(user.cardSlug);
  const [theme, setTheme] = useState<'light' | 'dark' | 'gold'>('light');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ user: User; cardUrl: string | null }>(`/api/admin/staff/${user.id}/card`, {
        ...form,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        location: form.location || null,
        linkedinUrl: form.linkedinUrl || null,
        avatarUrl: form.avatarUrl || null,
        bio: form.bio || null,
        specialities: form.specialities.split('\n').map((line) => line.trim()).filter(Boolean),
      }),
    onSuccess: (result) => {
      setSlug(result.user.cardSlug);
      toast.success(form.cardPublished ? 'Card published' : 'Card saved');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cardPath = slug ? `/card/${slug}` : null;
  const published = user.cardPublished && cardPath;

  async function copyLink() {
    if (!cardPath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${cardPath}`);
    toast.success('Card link copied');
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Digital card for ${user.name}`}
      description="Published cards are reachable by QR and can be saved straight into a phone's contacts."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>
            Save card
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <Input
            label="Job title"
            required
            value={form.jobTitle}
            onChange={(e) => set('jobTitle', e.target.value)}
            hint="Needed before the card can be published"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Input
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </div>
          <Input
            label="Location"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Accra, Ghana"
          />
          <Input
            label="LinkedIn"
            value={form.linkedinUrl}
            onChange={(e) => set('linkedinUrl', e.target.value)}
            placeholder="https://www.linkedin.com/in/..."
          />
          <Input
            label="Photograph URL"
            value={form.avatarUrl}
            onChange={(e) => set('avatarUrl', e.target.value)}
            hint="Upload one in Media and paste its address here"
          />
          <Textarea
            label="Short bio"
            rows={3}
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
          />
          <Textarea
            label="Specialities"
            rows={4}
            value={form.specialities}
            onChange={(e) => set('specialities', e.target.value)}
            hint="One per line, first four appear on the card"
          />
          <Checkbox
            label="Publish this card"
            description="Only a published card resolves at its web address"
            checked={form.cardPublished}
            onChange={(e) => set('cardPublished', e.target.checked)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="size-4 text-[var(--brand)]" aria-hidden />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Scannable code</h3>
            </div>

            {published ? (
              <>
                <div className="mx-auto w-48 rounded-2xl bg-white p-3 shadow-[var(--shadow-lift)]">
                  <Image
                    src={`/api/card/${slug}/qr?theme=${theme}&size=480`}
                    alt={`QR code for ${user.name}`}
                    width={176}
                    height={176}
                    unoptimized
                    className="w-full"
                  />
                </div>

                <div
                  className="mt-3 flex gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-1"
                  role="group"
                  aria-label="Code style"
                >
                  {(['light', 'dark', 'gold'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      aria-pressed={theme === option}
                      className={cn(
                        'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition-colors',
                        theme === option
                          ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ButtonLink
                    href={`/api/card/${slug}/qr?theme=${theme}&size=1200`}
                    target="_blank"
                    variant="outline"
                    size="sm"
                    leadingIcon={<Download className="size-4" aria-hidden />}
                  >
                    Code
                  </ButtonLink>
                  <ButtonLink
                    href={`/api/card/${slug}/wallpaper?theme=${theme === 'light' ? 'light' : 'dark'}`}
                    target="_blank"
                    variant="outline"
                    size="sm"
                    leadingIcon={<Download className="size-4" aria-hidden />}
                  >
                    Wallpaper
                  </ButtonLink>
                  <ButtonLink
                    href={cardPath}
                    target="_blank"
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Eye className="size-4" aria-hidden />}
                  >
                    Preview
                  </ButtonLink>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyLink}
                    leadingIcon={<Copy className="size-4" aria-hidden />}
                  >
                    Copy link
                  </Button>
                </div>

                <p className="mt-3 break-all text-center font-mono text-[0.6875rem] text-[var(--text-muted)]">
                  {cardPath}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <IdCard className="size-7 text-[var(--text-muted)]" aria-hidden />
                <p className="text-sm text-[var(--text-secondary)]">
                  Add a job title, tick publish and save.
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  The code and wallpaper appear here once the card is live.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            The wallpaper is sized for a phone lock screen, with the code in the middle and the
            brand clear of the clock. Anyone can scan it without the phone being unlocked.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
