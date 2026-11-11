'use client';

import Image from 'next/image';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ImageIcon, Images, X } from 'lucide-react';
import type { MediaAsset, Page } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Dialog, EmptyState, Pagination, Skeleton } from '@/components/ui/primitives';

interface MediaPage extends Page<MediaAsset> {
  folders: string[];
}

/**
 * An image field that can reach the library.
 *
 * The field used to be a bare text input with the hint "paste a URL from the
 * media library", which is a lot to ask: go to another page, hover a tile,
 * press copy, come back, paste, and hope the form you copied is one the image
 * optimiser accepts. It frequently was not.
 *
 * Choosing from the library writes the stored path directly, so the picture
 * works the first time. Pasting still works, for a CDN address or anything
 * hosted elsewhere.
 */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  wrapperClassName,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  wrapperClassName?: string;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className={wrapperClassName}>
      <div className="flex items-end gap-2">
        <Input
          label={label}
          wrapperClassName="flex-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/api/media/... or an external address"
          hint={hint ?? 'Choose from the library, or paste an address hosted elsewhere'}
        />
        <Button
          variant="secondary"
          onClick={() => setPicking(true)}
          leadingIcon={<Images className="size-4" aria-hidden />}
          className="mb-[1.625rem] shrink-0"
        >
          Library
        </Button>
      </div>

      {value && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-2">
          {/* A plain img, not next/image: this is a preview of whatever has
              been typed, including an address that turns out to be wrong,
              and the optimiser would refuse an unconfigured host outright. */}
          <img
            src={value}
            alt=""
            className="size-14 shrink-0 rounded-lg object-cover"
            onError={(event) => {
              event.currentTarget.style.visibility = 'hidden';
            }}
            onLoad={(event) => {
              event.currentTarget.style.visibility = 'visible';
            }}
          />
          <p className="min-w-0 flex-1 break-all font-mono text-[0.6875rem] text-[var(--text-muted)]">
            {value}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange('')}
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}

      {picking && (
        <MediaPicker
          onPick={(asset) => {
            onChange(asset.url);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function MediaPicker({
  onPick,
  onClose,
}: {
  onPick: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);

  const { data, isPending } = useQuery({
    queryKey: ['media', 'picker', page],
    queryFn: () => api.get<MediaPage>(`/api/admin/media?page=${page}&pageSize=18`),
    placeholderData: keepPreviousData,
  });

  const images = (data?.items ?? []).filter((asset) => asset.mimeType.startsWith('image/'));

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Choose an image"
      description="Everything in the media library. Uploading is done on the Media page."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      {isPending ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} className="aspect-square" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <EmptyState
          title="No images yet"
          description="Upload a photograph on the Media page and it will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {images.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onPick(asset)}
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]',
                  'transition-all hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow-lift)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                )}
                title={asset.altText || 'Untitled'}
              >
                {/* Through the optimiser: a library of 3MB originals is
                    unusable as a grid of thumbnails otherwise. Every asset
                    here is a relative path, which is exactly what the
                    optimiser accepts. */}
                <Image
                  src={asset.url}
                  alt={asset.altText}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-ink-950/55 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImageIcon className="size-5 text-white" aria-hidden />
                </span>
              </button>
            ))}
          </div>

          {data && data.pageCount > 1 && (
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              total={data.total}
              onChange={setPage}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
