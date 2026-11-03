import { NotFoundError } from '@core/errors';
import { contentDeps, repositories } from '@infra/deps';
import { deleteService, updateService } from '@app-layer/use-cases/content';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { serviceSchema, uuidSchema } from '@/presentation/validation/schemas';

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
  const input = serviceSchema.partial().parse(await request.json());
  return ok(await updateService(contentDeps(), actor, id, input as never));
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  const id = uuidSchema.parse((await context.params).id);
  await deleteService(contentDeps(), actor, id);
  return noContent();
});
