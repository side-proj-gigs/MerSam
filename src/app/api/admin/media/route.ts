import { ValidationError } from '@core/errors';
import { repositories } from '@infra/deps';
import { assertUploadAllowed, probeImageSize, resolveStorage } from '@infra/storage';
import { created, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { mediaSchema, parseListQuery } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const url = new URL(request.url);
  const repos = repositories();

  const [page, folders] = await Promise.all([
    repos.media.list({
      ...parseListQuery(url),
      folder: url.searchParams.get('folder') ?? undefined,
    }),
    repos.media.listFolders(),
  ]);

  return ok({ ...page, folders });
});

/**
 * Accepts either an uploaded file (multipart) or a reference to an image
 * already hosted elsewhere (JSON). Both end up as one row in media_assets, so
 * the picker in the admin treats them identically.
 */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const repos = repositories();
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const input = mediaSchema.parse(await request.json());
    const asset = await repos.media.create({
      id: crypto.randomUUID(),
      url: input.url,
      thumbnailUrl: input.thumbnailUrl ?? null,
      altText: input.altText,
      mimeType: input.mimeType,
      byteSize: 0,
      width: null,
      height: null,
      folder: input.folder,
      storageKey: null,
      uploadedBy: actor.userId,
      source: 'external',
    });
    return created(asset);
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('No file was included in the upload');

  const data = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'application/octet-stream';
  assertUploadAllowed(mimeType, data.byteLength);

  const folder = String(form.get('folder') ?? 'general');
  const storage = await resolveStorage();
  const stored = await storage.save({ folder, filename: file.name, mimeType, data });
  const dimensions = probeImageSize(data, mimeType);

  const id = crypto.randomUUID();
  const asset = await repos.media.create({
    id,
    // Served through our own route, so the storage driver stays swappable.
    url: `/api/media/${id}/raw`,
    thumbnailUrl: null,
    altText: String(form.get('altText') ?? '').slice(0, 300),
    mimeType: stored.mimeType,
    byteSize: stored.byteSize,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    folder,
    storageKey: stored.key,
    uploadedBy: actor.userId,
    source: 'upload',
  });

  await repos.audit.record({
    actorId: actor.userId,
    action: 'upload',
    entity: 'media',
    entityId: id,
    summary: `${actor.name} uploaded ${file.name} to ${folder}`,
  });

  return created(asset);
});
