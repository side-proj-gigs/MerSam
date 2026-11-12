import { NotFoundError } from '@core/errors';
import { contentDeps, repositories } from '@infra/deps';
import { deleteService, updateService } from '@app-layer/use-cases/content';
import { revalidatePublicSite } from '@/presentation/http/revalidate';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { parsePatch, serviceSchema, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const service = await repositories().services.findById(id);
  if (!service) throw new NotFoundError('Service', id);
  return ok(service);
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  const id = uuidSchema.parse((await context.params).id);
  const input = parsePatch(serviceSchema, await request.json());
  const service = await updateService(contentDeps(), actor, id, input as never);
  // Without this a changed hero image keeps showing the previous photograph,
  // because the services and service detail pages are prerendered.
  revalidatePublicSite();
  return ok(service);
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  const id = uuidSchema.parse((await context.params).id);
  await deleteService(contentDeps(), actor, id);
  revalidatePublicSite();
  return noContent();
});
