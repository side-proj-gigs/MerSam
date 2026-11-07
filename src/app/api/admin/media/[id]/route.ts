import { z } from 'zod';
import { NotFoundError } from '@core/errors';
import { repositories } from '@infra/deps';
import { removeStoredFile } from '@infra/storage';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  altText: z.string().trim().max(300).optional(),
  folder: z.string().trim().max(96).optional(),
});

export const PATCH = route(async (request: Request, context: Context) => {
  await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = patchSchema.parse(await request.json());
  return ok(await repositories().media.update(id, input));
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const repos = repositories();

  const asset = await repos.media.findById(id);
  if (!asset) throw new NotFoundError('Media asset', id);

  // Remove the row first; an orphaned object costs storage, an orphaned row
  // shows a broken image in the picker.
  await repos.media.delete(id);

  if (asset.storageKey) {
    await removeStoredFile(asset.storageKey).catch((error) => {
      console.error('Failed to remove stored object', asset.storageKey, error);
    });
  }

  await repos.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'media',
    entityId: id,
    summary: `${actor.name} removed a media asset`,
  });

  return noContent();
});
