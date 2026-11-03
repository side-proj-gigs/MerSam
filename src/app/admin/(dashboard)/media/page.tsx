'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaAsset, Page } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Card, Dialog, EmptyState, Pagination, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/admin/shell';

const MAX_BYTES = 8 * 1024 * 1024;

interface MediaPage extends Page<MediaAsset> {
  folders: string[];
}

export default function MediaPage() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>('');
  const [page, setPage] = useState(1);
  const [linking, setLinking] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['media', page, folder],
    queryFn: () =>
      api.get<MediaPage>(`/api/admin/media?page=${page}&pageSize=24${folder ? `&folder=${folder}` : ''}`),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/media/${id}`),
    onSuccess: () => {
      toast.success('Removed');
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);

    let succeeded = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 8MB`);
        continue;
      }

      const body = new FormData();
      body.set('file', file);
      body.set('folder', folder || 'general');
      body.set('altText', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));

      try {
        // Multipart goes through fetch directly: the browser has to set the
        // Content-Type itself so it can add the multipart boundary.
        const response = await fetch('/api/admin/media', { method: 'POST', body });
        if (response.ok) {
          succeeded += 1;
        } else {
          const payload = await response.json().catch(() => null);
          toast.error(payload?.error?.message ?? `Could not upload ${file.name}`);
        }
      } catch {
        toast.error(`Could not upload ${file.name}`);
      }
    }

    setUploading(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} file${succeeded === 1 ? '' : 's'} uploaded`);
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function copyUrl(asset: MediaAsset) {
    await navigator.clipboard.writeText(
      asset.source === 'external' ? asset.url : `${window.location.origin}${asset.url}`,
    );
    toast.success('Address copied');
  }

  return (
    <>
      <PageHeader
        title="Media"
        description="Photographs and documents used across the website. Uploads are stored in Neon."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLinking(true)}
              leadingIcon={<Link2 className="size-4" aria-hidden />}
            >
              Link a URL
            </Button>
            <Button
              variant="gold"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
              leadingIcon={<Upload className="size-4" aria-hidden />}
            >
              Upload
            </Button>
          </div>
        }
      />

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,application/pdf"
        className="hidden"
        onChange={(event) => upload(event.target.files)}
      />

      {data && data.folders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFolder('');
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              folder === ''
                ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
            )}
          >
            All
          </button>
          {data.folders.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setFolder(name);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                folder === name
                  ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="aspect-square" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Nothing uploaded yet"
            description="Upload photographs of your work, or link to an image hosted elsewhere."
            action={
              <Button variant="gold" onClick={() => fileInput.current?.click()}>
                Upload a file
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {data.items.map((asset) => (
              <figure
                key={asset.id}
                className="group relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
              >
                <div className="relative aspect-square">
                  {asset.mimeType.startsWith('image/') ? (
                    <Image
                      src={asset.url}
                      alt={asset.altText}
                      fill
                      sizes="(min-width: 1024px) 16vw, 44vw"
                      unoptimized={asset.source === 'upload'}
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-xs text-[var(--text-muted)]">
                      {asset.mimeType.split('/')[1]?.toUpperCase()}
                    </span>
                  )}

                  <div className="absolute inset-0 flex items-end justify-center gap-1.5 bg-ink-950/65 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => copyUrl(asset)}
                      className="grid size-8 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/30"
                      aria-label={`Copy the address of ${asset.altText || 'this file'}`}
                    >
                      <Copy className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => confirm('Remove this file?') && remove.mutate(asset.id)}
                      className="grid size-8 place-items-center rounded-lg bg-white/15 text-white hover:bg-[var(--color-danger)]"
                      aria-label={`Delete ${asset.altText || 'this file'}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <figcaption className="px-2 py-1.5">
                  <p className="truncate text-[0.6875rem] text-[var(--text-secondary)]">
                    {asset.altText || 'Untitled'}
                  </p>
                  <p className="text-[0.625rem] text-[var(--text-muted)]">
                    {formatDate(asset.createdAt)}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {data && data.total > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-4">
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              total={data.total}
              onChange={setPage}
            />
          </div>
        )}
      </Card>

      {linking && <LinkDialog folder={folder || 'general'} onClose={() => setLinking(false)} />}
    </>
  );
}

function LinkDialog({ folder, onClose }: { folder: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/admin/media', { url, altText, folder, mimeType: 'image/jpeg' }, { idempotent: false }),
    onSuccess: () => {
      toast.success('Added to the library');
      void queryClient.invalidateQueries({ queryKey: ['media'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Link an external image"
      description="Useful for stock photographs already hosted on a CDN."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={create.isPending}
            disabled={!url.startsWith('http')}
            onClick={() => create.mutate()}
          >
            Add to library
          </Button>
        </>
      }
    >
      <Input
        label="Image address"
        required
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://images.unsplash.com/photo-..."
      />
      <Input
        label="Description"
        wrapperClassName="mt-4"
        value={altText}
        onChange={(event) => setAltText(event.target.value)}
        hint="Read aloud by screen readers, so describe what is in the picture"
      />
    </Dialog>
  );
}
