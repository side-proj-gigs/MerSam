'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Expand,
  ExternalLink,
  FileText,
  ImageOff,
  Link2,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MediaAsset, Page } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn, formatDate } from '@/lib/utils';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Card, Dialog, EmptyState, Pagination, Skeleton } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/confirm';
import { PageHeader } from '@/components/admin/shell';

/**
 * Kept in step with MAX_UPLOAD_BYTES on the server, which in turn sits under
 * the 4.5MB a serverless request body may carry. A larger picture is not
 * refused, it is shrunk first.
 */
const MAX_BYTES = 4 * 1024 * 1024;

/** Above this, a photograph is bigger than any layout on the site needs. */
const MAX_DIMENSION = 2400;

/** Tried in turn until the result fits, so a stubborn file still gets in. */
const FALLBACK_DIMENSIONS = [MAX_DIMENSION, 1800, 1400, 1100];

const RESIZABLE = ['image/jpeg', 'image/png', 'image/webp'];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('That file could not be read as an image'));
    element.src = url;
  });
}

function drawToCanvas(image: HTMLImageElement, longestEdge: number): HTMLCanvasElement | null {
  const scale = Math.min(1, longestEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Whether any pixel is actually see-through.
 *
 * A PNG is often just a photograph or a screenshot with no transparency at
 * all, and those re-encode to a fraction of the size as JPEG. Checking costs
 * one pass over a sample of the pixels and is what lets a 12MB screenshot
 * through instead of refusing it.
 */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d');
  if (!context) return true;
  try {
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // Every 40th pixel: enough to catch a transparent region, cheap to scan.
    for (let i = 3; i < data.length; i += 4 * 40) {
      if (data[i]! < 255) return true;
    }
    return false;
  } catch {
    // If the pixels cannot be read, assume transparency and keep PNG.
    return true;
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Shrinks an oversized image in the browser before it is sent.
 *
 * A picture straight off a phone is routinely 5 to 10MB, which the platform
 * refuses outright, and is far larger than anything this site displays.
 * Rather than making that the person's problem, the longest edge is capped
 * and the encoding stepped down until it fits.
 *
 * Returns the original when it already fits, and null only when it genuinely
 * cannot be brought under the limit.
 */
async function downscaleImage(file: File): Promise<File | null> {
  if (file.size <= MAX_BYTES) return file;
  if (!RESIZABLE.includes(file.type)) return null;

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);

    for (const dimension of FALLBACK_DIMENSIONS) {
      const canvas = drawToCanvas(image, dimension);
      if (!canvas) return null;

      // JPEG unless a transparent pixel would be lost by flattening it.
      const keepAlpha = file.type !== 'image/jpeg' && hasTransparency(canvas);
      const type = keepAlpha ? 'image/png' : 'image/jpeg';
      // PNG ignores the quality argument, so there is one attempt per size.
      const qualities = keepAlpha ? [undefined] : [0.86, 0.72, 0.6, 0.45];

      for (const quality of qualities) {
        const blob = await toBlob(canvas, type, quality);
        if (blob && blob.size <= MAX_BYTES) {
          const stem = file.name.replace(/\.[^.]+$/, '');
          return new File([blob], `${stem}.${keepAlpha ? 'png' : 'jpg'}`, { type });
        }
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

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
  // Which tile is open in the viewer, held as an index so the arrows can move
  // through the page without closing and reopening.
  const [viewing, setViewing] = useState<number | null>(null);
  const askConfirm = useConfirm();

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
      // The viewer was showing the file that has just gone.
      setViewing(null);
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);

    let succeeded = 0;
    for (const original of Array.from(files)) {
      const file = await downscaleImage(original);
      if (!file) {
        toast.error(`${original.name} is ${megabytes(original.size)}`, {
          description: `Files must be under ${megabytes(MAX_BYTES)}, and this one could not be shrunk automatically. Save it smaller and try again.`,
          duration: 8000,
        });
        continue;
      }
      if (file !== original) {
        toast.message(`${original.name} was resized to fit`, {
          description: `${megabytes(original.size)} down to ${megabytes(file.size)}. The site never displays it larger than this.`,
        });
      }

      const body = new FormData();
      body.set('file', file);
      body.set('folder', folder || 'general');
      body.set('altText', original.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));

      try {
        // Multipart goes through fetch directly: the browser has to set the
        // Content-Type itself so it can add the multipart boundary.
        const response = await fetch('/api/admin/media', { method: 'POST', body });
        if (response.ok) {
          succeeded += 1;
          continue;
        }

        // A body the platform refuses never reaches our code, so the reply is
        // plain text rather than the usual envelope. Saying "could not upload"
        // to that leaves nobody any the wiser.
        if (response.status === 413) {
          toast.error(`${original.name} is too large for the server to accept`, {
            description: `The limit is ${megabytes(MAX_BYTES)} per file.`,
            duration: 8000,
          });
          continue;
        }

        const payload = await response.json().catch(() => null);
        toast.error(payload?.error?.message ?? `Could not upload ${original.name}`, {
          description: payload ? undefined : `The server answered ${response.status}.`,
          duration: 8000,
        });
      } catch {
        toast.error(`Could not upload ${original.name}`, {
          description: 'The request did not reach the server. Check your connection.',
        });
      }
    }

    setUploading(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} file${succeeded === 1 ? '' : 's'} uploaded`);
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function deleteAsset(asset: MediaAsset) {
    const confirmed = await askConfirm({
      title: `Delete ${asset.altText || 'this file'}?`,
      description:
        'The file is removed from the library and from anywhere on the website that points at it.',
      detail: (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{asset.mimeType}</span>
          {asset.width && asset.height && (
            <span className="text-xs text-[var(--text-muted)]">
              {asset.width} by {asset.height}
            </span>
          )}
        </span>
      ),
      confirmLabel: 'Delete file',
    });
    if (confirmed) remove.mutate(asset.id);
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
            {data.items.map((asset, index) => (
              <figure
                key={asset.id}
                className="group relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] transition-shadow focus-within:ring-2 focus-within:ring-[var(--brand)] hover:shadow-[var(--shadow-float)]"
              >
                <div className="relative aspect-square">
                  {/* The whole tile opens the viewer. A button rather than a
                      click handler on the figure, so it is reachable by
                      keyboard and announced as the action it is. */}
                  <button
                    type="button"
                    onClick={() => setViewing(index)}
                    className="absolute inset-0 z-10 cursor-zoom-in outline-none"
                    aria-label={`View ${asset.altText || 'this file'}`}
                  />

                  <AssetThumbnail asset={asset} />

                  {/* z-20 belongs on the overlay, not on the buttons inside it: the
                      opacity transition makes this a stacking context, so a
                      z-index set on a child is trapped within it and the
                      full-tile View button below would swallow every click. */}
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-between gap-1.5 bg-gradient-to-t from-ink-950/80 via-ink-950/10 to-transparent p-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <span className="pointer-events-none grid size-8 place-items-center rounded-lg bg-white/15 text-white backdrop-blur-sm">
                      <Expand className="size-3.5" aria-hidden />
                    </span>

                    <span className="pointer-events-auto flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyUrl(asset)}
                        className="grid size-8 place-items-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                        aria-label={`Copy the address of ${asset.altText || 'this file'}`}
                      >
                        <Copy className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAsset(asset)}
                        className="grid size-8 place-items-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-[var(--color-danger)]"
                        aria-label={`Delete ${asset.altText || 'this file'}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </span>
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

      {viewing !== null && data?.items[viewing] && (
        <AssetViewer
          assets={data.items}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onCopy={copyUrl}
          onDelete={deleteAsset}
          deleting={remove.isPending}
        />
      )}

      {linking && <LinkDialog folder={folder || 'general'} onClose={() => setLinking(false)} />}
    </>
  );
}

const isImage = (asset: MediaAsset) => asset.mimeType.startsWith('image/');
const isPdf = (asset: MediaAsset) => asset.mimeType === 'application/pdf';

/** The square in the grid. Cropped to fill, because the grid is a grid. */
function AssetThumbnail({ asset }: { asset: MediaAsset }) {
  if (isImage(asset)) {
    return (
      <Image
        src={asset.url}
        alt={asset.altText}
        fill
        sizes="(min-width: 1024px) 16vw, 44vw"
        unoptimized={asset.source === 'upload'}
        className="object-cover"
      />
    );
  }

  return (
    <span className="grid size-full place-items-center gap-1.5 text-[var(--text-muted)]">
      <FileText className="size-7" aria-hidden />
      <span className="text-[0.625rem] font-bold uppercase tracking-[0.1em]">
        {asset.mimeType.split('/')[1]?.replace('+xml', '') ?? 'file'}
      </span>
    </span>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

/**
 * The viewer. What the grid could never show: the whole picture, uncropped,
 * at the size it was actually uploaded at, with everything known about it
 * beside it.
 *
 * Arrow keys move through the page without closing, which is how anybody
 * looking for one particular photograph in a library of them expects to
 * work. A PDF is shown inline rather than described, because "PDF" tells you
 * nothing about which PDF it is.
 */
function AssetViewer({
  assets,
  index,
  onIndexChange,
  onClose,
  onCopy,
  onDelete,
  deleting,
}: {
  assets: MediaAsset[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  onCopy: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
  deleting: boolean;
}) {
  const asset = assets[index]!;
  const hasPrevious = index > 0;
  const hasNext = index < assets.length - 1;

  // Reset the loading shimmer whenever a different file comes into view.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [asset.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrevious) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, hasPrevious, hasNext, onIndexChange]);

  const absolute =
    asset.source === 'external'
      ? asset.url
      : typeof window === 'undefined'
        ? asset.url
        : `${window.location.origin}${asset.url}`;

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={asset.altText || 'Untitled file'}
      description={`${index + 1} of ${assets.length} on this page`}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasPrevious}
              onClick={() => onIndexChange(index - 1)}
              aria-label="Previous file"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasNext}
              onClick={() => onIndexChange(index + 1)}
              aria-label="Next file"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </span>

          <Button
            variant="ghost"
            onClick={() => onDelete(asset)}
            loading={deleting}
            className="text-[var(--color-danger)]"
            leadingIcon={<Trash2 className="size-4" aria-hidden />}
          >
            Delete
          </Button>
          <Button
            variant="secondary"
            onClick={() => onCopy(asset)}
            leadingIcon={<Copy className="size-4" aria-hidden />}
          >
            Copy address
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative flex min-h-[16rem] items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
          {/* A checkerboard, so a transparent PNG reads as transparent
              rather than as white on white. */}
          <span
            aria-hidden
            className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(45deg,var(--text-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--text-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--text-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--text-primary)_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]"
          />

          {isImage(asset) && failed ? (
            // A row can outlive its bytes, for instance when the object store
            // it was uploaded to no longer exists. Saying so beats an empty
            // frame that looks like the viewer is still thinking.
            <span className="relative grid max-w-sm place-items-center gap-2 p-10 text-center">
              <ImageOff className="size-9 text-[var(--text-muted)]" aria-hidden />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                This file cannot be displayed
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                The record is still here but the stored file is not. It was most likely held in an
                object store that is no longer reachable. Delete the entry and upload it again.
              </span>
            </span>
          ) : isImage(asset) ? (
            <>
              {!loaded && <Skeleton className="absolute inset-4" />}
              {/* Unoptimised and plain: this is the file itself, at full
                  size, which is the entire point of opening it. */}
              <img
                key={asset.id}
                src={asset.url}
                alt={asset.altText}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className={cn(
                  'relative max-h-[60vh] w-auto max-w-full object-contain transition-opacity duration-300',
                  loaded ? 'opacity-100' : 'opacity-0',
                )}
              />
            </>
          ) : isPdf(asset) ? (
            <object
              data={asset.url}
              type="application/pdf"
              className="relative h-[60vh] w-full"
              aria-label={asset.altText || 'Document preview'}
            >
              <span className="grid h-full place-items-center p-6 text-center text-sm text-[var(--text-secondary)]">
                This browser will not show the document inline. Open it in a new tab instead.
              </span>
            </object>
          ) : (
            <span className="relative grid place-items-center gap-2 p-10 text-[var(--text-muted)]">
              <FileText className="size-10" aria-hidden />
              <span className="text-sm">No preview for this type of file</span>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <Fact
              label="Type"
              value={<span className="font-mono text-xs">{asset.mimeType}</span>}
            />
            {asset.width && asset.height ? (
              <Fact label="Dimensions" value={`${asset.width} by ${asset.height} pixels`} />
            ) : null}
            {asset.byteSize > 0 && (
              <Fact label="Size" value={`${(asset.byteSize / 1024).toFixed(0)} KB`} />
            )}
            <Fact label="Folder" value={asset.folder || 'general'} />
            <Fact label="Added" value={formatDate(asset.createdAt, 'long')} />
            <Fact
              label="Source"
              value={
                <Badge tone={asset.source === 'upload' ? 'brand' : 'accent'}>
                  {asset.source === 'upload' ? 'Uploaded' : 'Linked'}
                </Badge>
              }
            />
          </dl>

          <div>
            <p className="mb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Address
            </p>
            <p className="break-all rounded-lg bg-[var(--surface-sunken)] px-2.5 py-2 font-mono text-[0.6875rem] text-[var(--text-secondary)]">
              {absolute}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={asset.url}
              target="_blank"
              variant="outline"
              size="sm"
              leadingIcon={<ExternalLink className="size-4" aria-hidden />}
            >
              Open
            </ButtonLink>
            <ButtonLink
              href={asset.url}
              target="_blank"
              variant="outline"
              size="sm"
              leadingIcon={<Download className="size-4" aria-hidden />}
            >
              Full size
            </ButtonLink>
          </div>
        </div>
      </div>
    </Dialog>
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
