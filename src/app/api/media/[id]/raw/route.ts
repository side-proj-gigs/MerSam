import { NextResponse } from 'next/server';
import { NotFoundError } from '@core/errors';
import { repositories } from '@infra/deps';
import { readStoredFile } from '@infra/storage';
import { route } from '@/presentation/http/respond';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';

/**
 * Serves uploaded media. Going through a route rather than exposing the bucket
 * means the storage driver can change without breaking a single stored URL,
 * and nothing has to be made publicly readable at the bucket level.
 *
 * The bytes behind an id never change (a replacement gets a new id), so the
 * response is marked immutable and the CDN keeps it for a year.
 */
export const GET = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await context.params).id);

  const asset = await repositories().media.findById(id);
  if (!asset) throw new NotFoundError('Media asset', id);

  // Externally hosted media is a redirect, not a proxy.
  if (asset.source === 'external' || !asset.storageKey) {
    return NextResponse.redirect(asset.url, 308);
  }

  // Asked of the store the key belongs to, so media uploaded under one driver
  // stays readable after the configuration changes underneath it.
  const file = await readStoredFile(asset.storageKey);
  if (!file) throw new NotFoundError('Media file', id);

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType || asset.mimeType,
      'Content-Length': String(file.data.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
